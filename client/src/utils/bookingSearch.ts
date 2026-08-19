import { addDays, parseISO } from 'date-fns';
import type { Booking } from '../types';

export const ROOM_THRESHOLDS = [30, 40, 60, 80, 100, 140] as const;

const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAMES = Object.keys(MONTH_LOOKUP).join('|');

export interface MonthDay {
  month: number;
  day: number;
}

export interface ParsedBookingSearch {
  text: string;
  maxRooms: number | null;
  dateFrom: MonthDay | null;
  dateTo: MonthDay | null;
  year: number | null;
}

function monthFromToken(token: string): number | null {
  return MONTH_LOOKUP[token.toLowerCase()] ?? null;
}

export function parseBookingSearch(raw: string): ParsedBookingSearch {
  let rest = raw.trim();
  let maxRooms: number | null = null;
  let dateFrom: MonthDay | null = null;
  let dateTo: MonthDay | null = null;
  let year: number | null = null;

  const occ = rest.match(/\b(?:less than|under|below|<)\s*(\d{1,3})\b/i);
  if (occ) {
    maxRooms = Number(occ[1]);
    rest = rest.replace(occ[0], ' ').replace(/\s+/g, ' ').trim();
  }

  const range = rest.match(
    new RegExp(
      `\\b(\\d{1,2})\\s*(?:\\/|-|–|to)\\s*(\\d{1,2})\\s+(${MONTH_NAMES})\\b(?:\\s+(\\d{4}))?`,
      'i',
    ),
  );
  if (range) {
    const month = monthFromToken(range[3]);
    if (month) {
      dateFrom = { month, day: Number(range[1]) };
      dateTo = { month, day: Number(range[2]) };
      year = range[4] ? Number(range[4]) : null;
      rest = rest.replace(range[0], ' ').replace(/\s+/g, ' ').trim();
    }
  } else {
    const single = rest.match(
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\b(?:\\s+(\\d{4}))?`, 'i'),
    );
    if (single) {
      const month = monthFromToken(single[2]);
      if (month) {
        dateFrom = { month, day: Number(single[1]) };
        dateTo = dateFrom;
        year = single[3] ? Number(single[3]) : null;
        rest = rest.replace(single[0], ' ').replace(/\s+/g, ' ').trim();
      }
    } else {
      const iso = rest.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      if (iso) {
        dateFrom = { month: Number(iso[2]), day: Number(iso[3]) };
        dateTo = dateFrom;
        year = Number(iso[1]);
        rest = rest.replace(iso[0], ' ').replace(/\s+/g, ' ').trim();
      } else {
        const dmy = rest.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (dmy) {
          dateFrom = { month: Number(dmy[2]), day: Number(dmy[1]) };
          dateTo = dateFrom;
          year = Number(dmy[3]);
          rest = rest.replace(dmy[0], ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
  }

  return { text: rest.toLowerCase(), maxRooms, dateFrom, dateTo, year };
}

function stayOverlapsMonthDay(booking: Booking, from: MonthDay, to: MonthDay, year: number | null) {
  const start = parseISO(booking.arrivalDate);
  const end = parseISO(booking.departureDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const startMd = from.month * 100 + from.day;
  const endMd = to.month * 100 + to.day;

  for (let d = start; d < end; d = addDays(d, 1)) {
    if (year && d.getFullYear() !== year) continue;
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    if (startMd <= endMd) {
      if (md >= startMd && md <= endMd) return true;
    } else if (md >= startMd || md <= endMd) {
      return true;
    }
  }
  return false;
}

function bookingHaystack(booking: Booking): string {
  const arrival = parseISO(booking.arrivalDate);
  const departure = parseISO(booking.departureDate);
  const dateBits: string[] = [];
  if (!Number.isNaN(arrival.getTime())) {
    dateBits.push(
      booking.arrivalDate,
      `${arrival.getDate()}/${arrival.getMonth() + 1}`,
      `${arrival.getDate()} ${arrival.toLocaleString('en-GB', { month: 'short' })}`,
      `${arrival.getDate()} ${arrival.toLocaleString('en-GB', { month: 'long' })}`,
    );
  }
  if (!Number.isNaN(departure.getTime())) {
    dateBits.push(
      booking.departureDate,
      `${departure.getDate()}/${departure.getMonth() + 1}`,
      `${departure.getDate()} ${departure.toLocaleString('en-GB', { month: 'short' })}`,
      `${departure.getDate()} ${departure.toLocaleString('en-GB', { month: 'long' })}`,
    );
  }
  return [
    booking.bookingRef,
    booking.guestOrGroupName,
    booking.finalRoom,
    booking.agentName,
    booking.roomCategoryOrStatus,
    booking.monthSheet,
    booking.remarks,
    ...dateBits,
  ]
    .join(' ')
    .toLowerCase();
}

export function bookingMatchesSearch(booking: Booking, parsed: ParsedBookingSearch): boolean {
  if (parsed.dateFrom && parsed.dateTo) {
    if (!stayOverlapsMonthDay(booking, parsed.dateFrom, parsed.dateTo, parsed.year)) {
      return false;
    }
  }
  if (!parsed.text) return true;
  return bookingHaystack(booking).includes(parsed.text);
}
