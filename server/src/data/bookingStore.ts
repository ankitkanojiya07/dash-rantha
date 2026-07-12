import type { Agent, Booking, DailyOccupancy, SyncLog } from '../types.js';
import { parseBookingExcel } from '../sync/excelParser.js';
import { buildAgentCanonicalMap, canonicalizeAgentName } from '../utils/agentName.js';

function getRoomNights(b: Booking) {
  return b.nights * b.noOfRooms;
}

function buildAgents(bookings: Booking[]): Agent[] {
  const map = new Map<string, { bookings: number; roomNights: number; rooms: number }>();

  for (const b of bookings) {
    const existing = map.get(b.agentName) ?? { bookings: 0, roomNights: 0, rooms: 0 };
    existing.bookings++;
    existing.roomNights += getRoomNights(b);
    existing.rooms += b.noOfRooms;
    map.set(b.agentName, existing);
  }

  return Array.from(map.entries())
    .map(([agentName, stats], i) => ({
      _id: `agent-${i + 1}`,
      agentName,
      totalBookings: stats.bookings,
      totalRoomNights: stats.roomNights,
      totalRooms: stats.rooms,
    }))
    .sort((a, b) => b.totalRoomNights - a.totalRoomNights);
}

function applyCanonicalAgentNames(bookings: Booking[]): Booking[] {
  const map = buildAgentCanonicalMap(bookings.map((b) => b.agentName));
  return bookings.map((b) => ({
    ...b,
    agentName: canonicalizeAgentName(b.agentName, map),
  }));
}

export interface BookingStore {
  bookings: Booking[];
  dailyOccupancy: DailyOccupancy[];
  agents: Agent[];
  syncLog: SyncLog;
  totalRooms: number;
}

let store: BookingStore | null = null;

export function loadBookingStore(): BookingStore {
  const parsed = parseBookingExcel();
  const bookings = applyCanonicalAgentNames(parsed.bookings);

  store = {
    bookings,
    dailyOccupancy: parsed.dailyOccupancy,
    agents: buildAgents(bookings),
    syncLog: parsed.syncLog,
    totalRooms: parsed.totalRooms,
  };

  console.log(
    `Loaded ${store.bookings.length} bookings from Excel (${store.syncLog.sheetsProcessed} sheets, ${store.syncLog.mismatches.length} mismatches)`,
  );

  return store;
}

export function getBookingStore(): BookingStore {
  if (!store) return loadBookingStore();
  return store;
}

export function refreshBookingStore(): BookingStore {
  return loadBookingStore();
}
