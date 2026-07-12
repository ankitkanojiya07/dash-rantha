const KNOWN_TYPES = ['DBL', 'TPL', 'SGL', 'QUAD', 'SUITE'] as const;

export function extractRoomType(finalRoom: string): string {
  const trimmed = finalRoom.trim();
  if (!trimmed) return 'Other';

  const upper = trimmed.toUpperCase();
  for (const type of KNOWN_TYPES) {
    if (upper.includes(type)) return type;
  }

  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1].toUpperCase().replace(/[^A-Z]/g, '');
  if (last && last.length <= 6) return last;

  return 'Other';
}

export interface RoomTypeCount {
  type: string;
  rooms: number;
  bookings: number;
}

export function countRoomsByType(
  bookings: { finalRoom: string; noOfRooms: number }[],
): RoomTypeCount[] {
  const map = new Map<string, { rooms: number; bookings: number }>();

  for (const b of bookings) {
    const type = extractRoomType(b.finalRoom);
    const existing = map.get(type) ?? { rooms: 0, bookings: 0 };
    existing.rooms += b.noOfRooms;
    existing.bookings += 1;
    map.set(type, existing);
  }

  const order = ['DBL', 'TPL', 'SGL', 'QUAD', 'SUITE'];
  return [...map.entries()]
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.rooms - a.rooms;
    });
}
