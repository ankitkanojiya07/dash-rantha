import { createHash } from 'crypto';
import type { Agent, Booking, DailyOccupancy, DailyRoomsByType, SyncLog } from '../types.js';
import { parseBookingExcelBuffer } from '../sync/excelParser.js';
import { downloadGoogleSheetXlsx, getGoogleSheetsId } from '../sync/googleSheets.js';
import { buildAgentCanonicalMap, canonicalizeAgentName } from '../utils/agentName.js';
import { buildCategoryCanonicalMap, canonicalizeCategory } from '../utils/categoryName.js';

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

function applyCanonicalLabels(bookings: Booking[]): Booking[] {
  const agentMap = buildAgentCanonicalMap(bookings.map((b) => b.agentName));
  const categoryMap = buildCategoryCanonicalMap(bookings.map((b) => b.roomCategoryOrStatus));
  return bookings.map((b) => ({
    ...b,
    agentName: canonicalizeAgentName(b.agentName, agentMap),
    roomCategoryOrStatus: canonicalizeCategory(b.roomCategoryOrStatus, categoryMap),
  }));
}

export interface BookingStore {
  bookings: Booking[];
  dailyOccupancy: DailyOccupancy[];
  dailyRoomsByType: DailyRoomsByType[];
  agents: Agent[];
  syncLog: SyncLog;
  totalRooms: number;
}

let store: BookingStore | null = null;
let storeLoadedAt = 0;
let loadPromise: Promise<BookingStore> | null = null;

/** How long a loaded snapshot is reused before re-downloading Google Sheets. */
const STORE_TTL_MS = Number(process.env.BOOKING_STORE_TTL_MS || 2 * 60 * 1000);

function storeIsFresh(): boolean {
  return Boolean(store) && Date.now() - storeLoadedAt < STORE_TTL_MS;
}

function buildStore(parsed: {
  bookings: Booking[];
  dailyOccupancy: DailyOccupancy[];
  dailyRoomsByType: DailyRoomsByType[];
  syncLog: SyncLog;
  totalRooms: number;
}): BookingStore {
  const bookings = applyCanonicalLabels(parsed.bookings);
  return {
    bookings,
    dailyOccupancy: parsed.dailyOccupancy,
    dailyRoomsByType: parsed.dailyRoomsByType,
    agents: buildAgents(bookings),
    syncLog: parsed.syncLog,
    totalRooms: parsed.totalRooms,
  };
}

async function loadFromGoogle(): Promise<BookingStore> {
  const sheetId = getGoogleSheetsId();
  const buffer = await downloadGoogleSheetXlsx(sheetId);
  const parsed = parseBookingExcelBuffer(buffer);
  parsed.syncLog.sheetId = sheetId;
  parsed.syncLog.contentBytes = buffer.length;
  parsed.syncLog.contentHash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const next = buildStore(parsed);
  console.log(
    `Loaded ${next.bookings.length} bookings from Google Sheets (${sheetId}, ${parsed.syncLog.contentBytes}b #${parsed.syncLog.contentHash}) — ${next.syncLog.sheetsProcessed} sheets, ${next.syncLog.mismatches.length} mismatches`,
  );
  return next;
}

async function loadAndCache(): Promise<BookingStore> {
  if (!loadPromise) {
    loadPromise = loadFromGoogle()
      .then((next) => {
        store = next;
        storeLoadedAt = Date.now();
        return next;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export async function ensureBookingStore(): Promise<BookingStore> {
  if (storeIsFresh()) return store!;
  return loadAndCache();
}

/** Sync accessor — store must already be loaded via ensureBookingStore(). */
export function getBookingStore(): BookingStore {
  if (!store) {
    throw new Error('Booking store not loaded yet. Call ensureBookingStore() first.');
  }
  return store;
}

export async function refreshBookingStore(): Promise<BookingStore> {
  // Drop stale snapshot so concurrent ensureBookingStore waits on this reload.
  store = null;
  storeLoadedAt = 0;
  return loadAndCache();
}
