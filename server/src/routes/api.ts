import { Router } from 'express';
import { getBookingStore, refreshBookingStore } from '../data/bookingStore.js';
import type { Booking, BookingOverlap, DashboardKPIs } from '../types.js';
import { countRoomsByType, withPrimaryRoomTypes } from '../utils/roomType.js';
import { getAgentEmail } from '../config/agentEmails.js';
import { bookingsToCsv, sendBookingsCsvMail } from '../services/mailService.js';

const router = Router();

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function getRoomNights(b: Booking) {
  return b.nights * b.noOfRooms;
}

function parseDate(s: string) {
  return new Date(s + 'T00:00:00');
}

router.get('/dashboard/kpis', (_req, res) => {
  const { bookings, dailyOccupancy, syncLog, totalRooms } = getBookingStore();
  const today = new Date().toISOString().split('T')[0];
  const todayOcc = dailyOccupancy.find((o) => o.date === today);
  const occupancyToday = todayOcc
    ? Math.round((todayOcc.roomsOccupied / totalRooms) * 100)
    : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  let weekRooms = 0;
  let weekDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const occ = dailyOccupancy.find((o) => o.date === key);
    if (occ) {
      weekRooms += occ.roomsOccupied;
      weekDays++;
    }
  }
  const occupancyThisWeek = weekDays > 0
    ? Math.round((weekRooms / (weekDays * totalRooms)) * 100)
    : 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  const mtdBookings = bookings.filter((b) => b.arrivalDate >= monthStartStr);
  const totalRoomNightsMTD = mtdBookings.reduce((s, b) => s + getRoomNights(b), 0);

  const activeBookings = bookings.filter((b) => {
    const arr = parseDate(b.arrivalDate);
    const dep = parseDate(b.departureDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return arr <= now && dep > now;
  }).length;

  const agentMonthMap = new Map<string, number>();
  for (const b of mtdBookings) {
    agentMonthMap.set(b.agentName, (agentMonthMap.get(b.agentName) ?? 0) + getRoomNights(b));
  }
  let topAgent = { name: '—', roomNights: 0 };
  for (const [name, rn] of agentMonthMap) {
    if (rn > topAgent.roomNights) topAgent = { name, roomNights: rn };
  }

  const kpis: DashboardKPIs = {
    occupancyToday,
    occupancyThisWeek,
    totalRoomNightsMTD,
    activeBookings,
    topAgentThisMonth: topAgent,
    lastSyncAt: syncLog.syncedAt,
    totalRooms,
  };

  res.json(kpis);
});

router.get('/occupancy', (req, res) => {
  const { dailyOccupancy, totalRooms } = getBookingStore();
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const data = dailyOccupancy
    .filter((o) => o.date >= cutoffStr)
    .map((o) => ({
      ...o,
      occupancyPct: Math.round((o.roomsOccupied / totalRooms) * 100),
    }));

  res.json(data);
});

function getOccupiedBookings(bookings: Booking[], date: string) {
  return bookings.filter((b) => b.arrivalDate <= date && b.departureDate > date);
}

router.get('/bookings/today', (_req, res) => {
  const { bookings } = getBookingStore();
  const today = new Date().toISOString().split('T')[0];
  const arrivals = bookings.filter((b) => b.arrivalDate === today);
  const departures = bookings.filter((b) => b.departureDate === today);
  const occupied = getOccupiedBookings(bookings, today);
  const byType = withPrimaryRoomTypes(countRoomsByType(occupied));
  const totalRooms = byType.reduce((s, x) => s + x.rooms, 0);
  res.json({ arrivals, departures, occupied: { date: today, totalRooms, byType } });
});

router.get('/bookings/occupied', (req, res) => {
  const { bookings } = getBookingStore();
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const occupied = getOccupiedBookings(bookings, date);
  const byType = withPrimaryRoomTypes(countRoomsByType(occupied));
  const totalRooms = byType.reduce((s, x) => s + x.rooms, 0);
  res.json({ date, totalRooms, byType });
});

router.get('/bookings', (req, res) => {
  const { bookings } = getBookingStore();
  let result = [...bookings];

  const { agent, month, year, category, from, to, search } = req.query;

  if (agent) result = result.filter((b) => b.agentName === agent);
  if (month) result = result.filter((b) => b.monthSheet === month);
  if (year) result = result.filter((b) => b.arrivalDate.startsWith(String(year)));
  if (category) result = result.filter((b) => b.roomCategoryOrStatus === category);
  if (from) result = result.filter((b) => b.arrivalDate >= (from as string));
  if (to) result = result.filter((b) => b.arrivalDate <= (to as string));
  if (search) {
    const q = (search as string).toLowerCase();
    result = result.filter(
      (b) =>
        b.guestOrGroupName.toLowerCase().includes(q) ||
        b.bookingRef.toLowerCase().includes(q) ||
        b.finalRoom.toLowerCase().includes(q)
    );
  }

  result.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  res.json(result);
});

router.get('/bookings/:id', (req, res) => {
  const { bookings } = getBookingStore();
  const booking = bookings.find((b) => b._id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  res.json(booking);
});

router.get('/agents', (_req, res) => {
  res.json(getBookingStore().agents);
});

router.get('/agents/leaderboard', (_req, res) => {
  const { agents } = getBookingStore();
  const totalRN = agents.reduce((s, a) => s + a.totalRoomNights, 0);
  const leaderboard = agents.map((a) => ({
    ...a,
    shareOfBusiness: totalRN > 0 ? Math.round((a.totalRoomNights / totalRN) * 1000) / 10 : 0,
  }));
  res.json(leaderboard);
});

/** Top N agents with configured recipient emails (for Send Mail page). */
router.get('/agents/top', (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || '5'), 10) || 5, 50);
  const { agents } = getBookingStore();
  const totalRN = agents.reduce((s, a) => s + a.totalRoomNights, 0);
  const top = agents.slice(0, limit).map((a, i) => ({
    ...a,
    rank: i + 1,
    shareOfBusiness: totalRN > 0 ? Math.round((a.totalRoomNights / totalRN) * 1000) / 10 : 0,
    email: getAgentEmail(a.agentName),
  }));
  res.json(top);
});

/**
 * Send agent booking CSV for a date range via nodemailer (Gmail).
 * Body: { agentName, from, to, email? }
 * `email` overrides the configured agent email when provided.
 */
router.post('/agents/send-mail', async (req, res, next) => {
  try {
    const agentName = String(req.body?.agentName || '').trim();
    const from = String(req.body?.from || '').trim();
    const to = String(req.body?.to || '').trim();
    const emailOverride = String(req.body?.email || '').trim();

    if (!agentName) return res.status(400).json({ error: 'agentName is required' });
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required (YYYY-MM-DD)' });
    if (from > to) return res.status(400).json({ error: 'from date must be on or before to date' });

    const recipient = emailOverride || getAgentEmail(agentName);
    if (!recipient) {
      return res.status(400).json({
        error: `No email configured for agent "${agentName}". Add it in server/src/config/agentEmails.ts or pass email in the request.`,
      });
    }

    const { bookings } = getBookingStore();
    const filtered = bookings
      .filter((b) => b.agentName === agentName && b.arrivalDate >= from && b.arrivalDate <= to)
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));

    if (!filtered.length) {
      return res.status(404).json({
        error: `No bookings found for ${agentName} between ${from} and ${to}`,
      });
    }

    const csv = bookingsToCsv(filtered);
    const result = await sendBookingsCsvMail({
      to: recipient,
      agentName,
      fromDate: from,
      toDate: to,
      csv,
      bookingCount: filtered.length,
    });

    res.json({
      message: 'Mail sent successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/calendar', (req, res) => {
  const { bookings } = getBookingStore();
  const { year, month } = req.query;
  const y = parseInt(year as string) || new Date().getFullYear();
  const m = parseInt(month as string) || new Date().getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = new Date(y, m, 0);
  const end = endDate.toISOString().split('T')[0];

  const monthBookings = bookings.filter((b) => {
    return b.arrivalDate <= end && b.departureDate > start;
  });

  res.json(monthBookings);
});

router.get('/overlaps', (_req, res) => {
  const { bookings } = getBookingStore();
  const overlaps: BookingOverlap[] = [];

  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      if (a.finalRoom !== b.finalRoom) continue;

      const aStart = parseDate(a.arrivalDate);
      const aEnd = parseDate(a.departureDate);
      const bStart = parseDate(b.arrivalDate);
      const bEnd = parseDate(b.departureDate);

      if (aStart < bEnd && bStart < aEnd) {
        const overlapStart = aStart > bStart ? aStart : bStart;
        const overlapEnd = aEnd < bEnd ? aEnd : bEnd;
        overlaps.push({
          booking1: a,
          booking2: b,
          room: a.finalRoom,
          overlapStart: overlapStart.toISOString().split('T')[0],
          overlapEnd: overlapEnd.toISOString().split('T')[0],
        });
      }
    }
  }

  res.json(overlaps);
});

router.get('/guests', (_req, res) => {
  const { bookings } = getBookingStore();
  const map = new Map<string, Booking[]>();
  for (const b of bookings) {
    const list = map.get(b.guestOrGroupName) ?? [];
    list.push(b);
    map.set(b.guestOrGroupName, list);
  }

  const guests = Array.from(map.entries())
    .map(([name, stays]) => ({
      guestOrGroupName: name,
      totalStays: stays.length,
      totalRoomNights: stays.reduce((s, b) => s + getRoomNights(b), 0),
      lastStay: stays.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate))[0],
      stays: stays.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)),
    }))
    .sort((a, b) => b.totalStays - a.totalStays);

  res.json(guests);
});

router.get('/reports/monthly', (_req, res) => {
  const { bookings, agents } = getBookingStore();
  const categories = [
    ...new Set(bookings.map((b) => b.roomCategoryOrStatus).filter(Boolean)),
  ].sort();

  const report = MONTHS.map((month) => {
    const monthBookings = bookings.filter((b) => b.monthSheet === month);
    return {
      month,
      bookings: monthBookings.length,
      roomNights: monthBookings.reduce((s, b) => s + getRoomNights(b), 0),
      rooms: monthBookings.reduce((s, b) => s + b.noOfRooms, 0),
      byAgent: agents
        .map((a) => {
          const ab = monthBookings.filter((b) => b.agentName === a.agentName);
          return {
            agentName: a.agentName,
            bookings: ab.length,
            roomNights: ab.reduce((s, b) => s + getRoomNights(b), 0),
          };
        })
        .filter((x) => x.bookings > 0),
      byCategory: categories
        .map((cat) => {
          const cb = monthBookings.filter((b) => b.roomCategoryOrStatus === cat);
          return {
            category: cat,
            bookings: cb.length,
            roomNights: cb.reduce((s, b) => s + getRoomNights(b), 0),
          };
        })
        .filter((x) => x.bookings > 0),
    };
  });

  res.json(report);
});

router.get('/sync', (_req, res) => {
  res.json(getBookingStore().syncLog);
});

router.post('/sync/refresh', async (_req, res, next) => {
  try {
    const store = await refreshBookingStore();
    res.json({
      message: 'Sync complete',
      syncedAt: store.syncLog.syncedAt,
      source: store.syncLog.source,
      rowsProcessed: store.syncLog.rowsProcessed,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
