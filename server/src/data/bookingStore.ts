import type { Agent, Booking, DailyOccupancy, SyncLog } from '../types.js';
import { parseBookingExcelBuffer } from '../sync/excelParser.js';
import { downloadGoogleSheetXlsx, getGoogleSheetsId } from '../sync/googleSheets.js';
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
let loadPromise: Promise<BookingStore> | null = null;

function buildStore(parsed: {
  bookings: Booking[];
  dailyOccupancy: DailyOccupancy[];
  syncLog: SyncLog;
  totalRooms: number;
}): BookingStore {
  const bookings = applyCanonicalAgentNames(parsed.bookings);
  return {
    bookings,
    dailyOccupancy: parsed.dailyOccupancy,
    agents: buildAgents(bookings),
    syncLog: parsed.syncLog,
    totalRooms: parsed.totalRooms,
  };
}

async function loadFromGoogle(): Promise<BookingStore> {
  const sheetId = getGoogleSheetsId();
  const buffer = await downloadGoogleSheetXlsx(sheetId);
  const parsed = parseBookingExcelBuffer(buffer);
  const next = buildStore(parsed);
  console.log(
    `Loaded ${next.bookings.length} bookings from Google Sheets (${sheetId}) — ${next.syncLog.sheetsProcessed} sheets, ${next.syncLog.mismatches.length} mismatches`,
  );
  return next;
}

export async function ensureBookingStore(): Promise<BookingStore> {
  if (store) return store;
  if (!loadPromise) {
    loadPromise = loadFromGoogle()
      .then((next) => {
        store = next;
        return next;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

/** Sync accessor — store must already be loaded via ensureBookingStore(). */
export function getBookingStore(): BookingStore {
  if (!store) {
    throw new Error('Booking store not loaded yet. Call ensureBookingStore() first.');
  }
  return store;
}

export async function refreshBookingStore(): Promise<BookingStore> {
  loadPromise = loadFromGoogle()
    .then((next) => {
      store = next;
      return next;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}
