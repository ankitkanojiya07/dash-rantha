import type { Booking } from '../types';

const KNOWN_TYPES = ['DBL', 'SGL', 'TPL', 'QUAD', 'SUITE'] as const;

export function extractRoomType(finalRoom: string): string {
  const trimmed = finalRoom.trim();
  if (!trimmed) return 'Other';

  const upper = trimmed.toUpperCase();
  if (/\bSINGLE\b/.test(upper) || /\bSG\b/.test(upper)) return 'SGL';

  for (const type of KNOWN_TYPES) {
    if (new RegExp(`\\b${type}\\b`).test(upper)) return type;
  }

  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1].toUpperCase().replace(/[^A-Z]/g, '');
  if (last === 'SINGLE' || last === 'SG') return 'SGL';
  if (last && last.length <= 6) return last;

  return 'Other';
}

export interface RoomTypeCount {
  type: string;
  rooms: number;
  bookings: number;
}

function sortByTypeOrder(a: RoomTypeCount, b: RoomTypeCount): number {
  const order = [...KNOWN_TYPES];
  const ai = order.indexOf(a.type as (typeof KNOWN_TYPES)[number]);
  const bi = order.indexOf(b.type as (typeof KNOWN_TYPES)[number]);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return b.rooms - a.rooms;
}

export function countRoomsByType(bookings: Booking[]): RoomTypeCount[] {
  const map = new Map<string, { rooms: number; bookings: number }>();

  for (const b of bookings) {
    const type = extractRoomType(b.finalRoom);
    const existing = map.get(type) ?? { rooms: 0, bookings: 0 };
    existing.rooms += b.noOfRooms;
    existing.bookings += 1;
    map.set(type, existing);
  }

  return [...map.entries()]
    .map(([type, stats]) => ({ type, ...stats }))
    .sort(sortByTypeOrder);
}

/** Ensure DBL / SGL / TPL always appear in summary chips (0 when none booked). */
export function withPrimaryRoomTypes(byType: RoomTypeCount[]): RoomTypeCount[] {
  if (byType.length === 0) return byType;

  const map = new Map(byType.map((item) => [item.type, item]));
  for (const type of ['DBL', 'SGL', 'TPL'] as const) {
    if (!map.has(type)) map.set(type, { type, rooms: 0, bookings: 0 });
  }

  return [...map.values()].sort(sortByTypeOrder);
}
