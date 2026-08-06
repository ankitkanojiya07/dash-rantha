import XLSX from 'xlsx';
import type {
  Booking,
  DailyOccupancy,
  DailyRoomsByType,
  RoomTypeCount,
  SyncLog,
  SyncMismatch,
} from '../types.js';
import { countRoomsByType, extractRoomType } from '../utils/roomType.js';

const MONTH_SHEETS = [
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug',
] as const;

type Row = unknown[];

export interface ParsedData {
  bookings: Booking[];
  dailyOccupancy: DailyOccupancy[];
  dailyRoomsByType: DailyRoomsByType[];
  syncLog: SyncLog;
  totalRooms: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthFromArrival(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return MONTHS_SHORT[month - 1] ?? 'Jan';
}

function isValidArrivalDate(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  return year >= 2025 && year <= 2030;
}

function bookingKey(b: Pick<Booking, 'guestOrGroupName' | 'finalRoom' | 'arrivalDate' | 'agentName' | 'nights' | 'noOfRooms'>) {
  return [b.guestOrGroupName, b.finalRoom, b.arrivalDate, b.agentName, b.nights, b.noOfRooms].join('|');
}

function dedupeBookings(bookings: Booking[]): Booking[] {
  const seen = new Map<string, Booking>();
  for (const booking of bookings) {
    const key = bookingKey(booking);
    if (!seen.has(key)) seen.set(key, booking);
  }
  return [...seen.values()];
}

function excelDateToIso(serial: unknown): string | null {
  if (typeof serial === 'number' && serial >= 30000) {
    const d = XLSX.SSF.parse_date_code(serial);
    if (!d?.y || !d?.m || !d?.d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  if (typeof serial === 'string') {
    const trimmed = serial.trim();
    // DD/MM/YYYY or D/M/YYYY
    const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    // YYYY-MM-DD
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return trimmed;
  }

  return null;
}

/** Col B years are corrupted — keep month/day only. */
function excelSerialMonthDay(serial: unknown): { month: number; day: number } | null {
  if (typeof serial !== 'number' || serial < 1) return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d?.m || !d?.d) return null;
  return { month: d.m, day: d.d };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function cellString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function cellNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isTotalRow(row: Row): boolean {
  return cellString(row[1]).toUpperCase().includes('TOTAL');
}

function isBookingRow(row: Row): boolean {
  const groupName = cellString(row[2]);
  if (!groupName || groupName === '2026') return false;
  if (isTotalRow(row)) return false;
  return true;
}

function resolveDayBlockIso(
  daySerial: number | null,
  arrivalDate: string,
): string | null {
  const md = excelSerialMonthDay(daySerial);
  if (!md) return null;
  const year = arrivalDate.slice(0, 4);
  return `${year}-${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
}

function addToDayTypeMap(
  dailyTypeMap: Map<string, Map<string, { rooms: number; bookings: number }>>,
  date: string,
  finalRoom: string,
  noOfRooms: number,
) {
  const type = extractRoomType(finalRoom);
  let typeMap = dailyTypeMap.get(date);
  if (!typeMap) {
    typeMap = new Map();
    dailyTypeMap.set(date, typeMap);
  }
  const existing = typeMap.get(type) ?? { rooms: 0, bookings: 0 };
  existing.rooms += noOfRooms;
  existing.bookings += 1;
  typeMap.set(type, existing);
}

function parseMonthSheet(
  sheetName: string,
  rows: Row[],
  refCounters: Map<string, number>,
  syncedAt: string,
  dailyTypeMap: Map<string, Map<string, { rooms: number; bookings: number }>>,
): { bookings: Booking[]; mismatches: SyncMismatch[] } {
  const bookings: Booking[] = [];
  const mismatches: SyncMismatch[] = [];

  const dayBlockSums = new Map<number, number>();
  const dayBlockIsoBySerial = new Map<number, string>();
  let lastDaySerial: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (isTotalRow(row)) {
      const expected = cellNumber(row[4]);
      if (expected > 0) {
        const dayDate = typeof row[1] === 'number' ? row[1] : lastDaySerial;
        const blockKeys = dayDate != null ? [dayDate] : [...dayBlockSums.keys()];
        for (const key of blockKeys) {
          const actual = dayBlockSums.get(key) ?? 0;
          if (actual !== expected) {
            const iso = dayBlockIsoBySerial.get(key) ?? excelDateToIso(key);
            mismatches.push({
              date: iso ?? `${sheetName}-row-${i + 1}`,
              expectedTotal: expected,
              actualSum: actual,
            });
          }
          dayBlockSums.delete(key);
        }
      }
      continue;
    }

    if (!isBookingRow(row)) continue;

    const noOfRooms = cellNumber(row[4]);
    const arrivalDate = excelDateToIso(row[6]);
    if (!arrivalDate || !isValidArrivalDate(arrivalDate) || noOfRooms <= 0) continue;

    const nights = cellNumber(row[8]);
    if (nights <= 0) continue;

    // Sheet col H is often wrong (e.g. Dec for a 3-night Aug stay). Trust nights.
    const departureDate = addDays(arrivalDate, nights);

    const daySerial = typeof row[1] === 'number' ? row[1] : lastDaySerial;
    if (typeof row[1] === 'number') lastDaySerial = row[1];

    if (daySerial != null) {
      dayBlockSums.set(daySerial, (dayBlockSums.get(daySerial) ?? 0) + noOfRooms);
      const blockIso = resolveDayBlockIso(daySerial, arrivalDate);
      if (blockIso) {
        dayBlockIsoBySerial.set(daySerial, blockIso);
        addToDayTypeMap(dailyTypeMap, blockIso, cellString(row[3]), noOfRooms);
      }
    }

    const arrivalMonth = monthFromArrival(arrivalDate);
    const counter = (refCounters.get(arrivalMonth) ?? 0) + 1;
    refCounters.set(arrivalMonth, counter);
    const yearSuffix = arrivalDate.slice(2, 4);
    const remarks = [row[10], row[11]].map(cellString).filter(Boolean).join(' | ');

    bookings.push({
      _id: `bkg-${arrivalMonth}-${counter}`,
      bookingRef: `${arrivalMonth.toUpperCase()}${yearSuffix}-${String(counter).padStart(4, '0')}`,
      monthSheet: arrivalMonth,
      guestOrGroupName: cellString(row[2]),
      finalRoom: cellString(row[3]),
      noOfRooms,
      agentName: cellString(row[5]) || 'Unknown',
      arrivalDate,
      departureDate,
      nights,
      roomCategoryOrStatus: cellString(row[9]),
      remarks,
      syncedAt,
      sourceRow: i + 1,
    });
  }

  return { bookings, mismatches };
}

function parseSheet4(workbook: XLSX.WorkBook): DailyOccupancy[] {
  const sheet = workbook.Sheets['Sheet4'];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: '' });
  const occupancy: DailyOccupancy[] = [];

  for (let i = 1; i < rows.length; i++) {
    const date = excelDateToIso(rows[i][0]);
    const rooms = cellNumber(rows[i][1]);
    if (!date || rooms < 0) continue;
    occupancy.push({
      _id: `occ-${date}`,
      date,
      roomsOccupied: rooms,
    });
  }

  return occupancy.sort((a, b) => a.date.localeCompare(b.date));
}

function buildOccupancyFromDayBlocks(
  dailyTypeMap: Map<string, Map<string, { rooms: number; bookings: number }>>,
): DailyOccupancy[] {
  return [...dailyTypeMap.entries()]
    .map(([date, typeMap]) => ({
      _id: `occ-${date}`,
      date,
      roomsOccupied: [...typeMap.values()].reduce((s, t) => s + t.rooms, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildDailyRoomsByType(
  dailyTypeMap: Map<string, Map<string, { rooms: number; bookings: number }>>,
): DailyRoomsByType[] {
  return [...dailyTypeMap.entries()]
    .map(([date, typeMap]) => {
      const byType = countRoomsByType(
        [...typeMap.entries()].map(([type, stats]) => ({
          // countRoomsByType keys off finalRoom text; pass the type code directly
          finalRoom: type,
          noOfRooms: stats.rooms,
        })),
      ).map((row) => ({
        type: row.type,
        rooms: typeMap.get(row.type)?.rooms ?? row.rooms,
        bookings: typeMap.get(row.type)?.bookings ?? 0,
      }));

      // Restore booking counts (countRoomsByType above used one synthetic row per type)
      for (const row of byType) {
        row.bookings = typeMap.get(row.type)?.bookings ?? 0;
      }

      const totalRooms = byType.reduce((s, x) => s + x.rooms, 0);
      return { date, totalRooms, byType };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeOccupancy(preferred: DailyOccupancy[], fallback: DailyOccupancy[]): DailyOccupancy[] {
  const map = new Map<string, DailyOccupancy>();
  for (const row of fallback) map.set(row.date, row);
  for (const row of preferred) map.set(row.date, row);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function inferTotalRooms(workbook: XLSX.WorkBook): number {
  let maxTotal = 0;

  for (const sheetName of MONTH_SHEETS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      if (isTotalRow(row)) {
        maxTotal = Math.max(maxTotal, cellNumber(row[4]));
      }
    }
  }

  return maxTotal > 0 ? maxTotal : 83;
}

export function parseBookingWorkbook(workbook: XLSX.WorkBook): ParsedData {
  const syncedAt = new Date().toISOString();
  const refCounters = new Map<string, number>();
  const dailyTypeMap = new Map<string, Map<string, { rooms: number; bookings: number }>>();

  const allBookings: Booking[] = [];
  const allMismatches: SyncMismatch[] = [];
  let sheetsProcessed = 0;

  for (const sheetName of MONTH_SHEETS) {
    if (!workbook.Sheets[sheetName]) continue;
    sheetsProcessed++;

    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
    });

    const { bookings, mismatches } = parseMonthSheet(
      sheetName,
      rows,
      refCounters,
      syncedAt,
      dailyTypeMap,
    );
    allBookings.push(...bookings);
    allMismatches.push(...mismatches);
  }

  const uniqueBookings = dedupeBookings(allBookings);
  const sheet4Occupancy = parseSheet4(workbook);
  const dayBlockOccupancy = buildOccupancyFromDayBlocks(dailyTypeMap);
  const dailyOccupancy = mergeOccupancy(sheet4Occupancy, dayBlockOccupancy);
  const dailyRoomsByType = buildDailyRoomsByType(dailyTypeMap);
  const totalRooms = inferTotalRooms(workbook);

  const syncLog: SyncLog = {
    _id: 'sync-latest',
    syncedAt,
    sheetsProcessed,
    rowsProcessed: uniqueBookings.length,
    mismatches: allMismatches,
    status: allMismatches.length > 0 ? 'warning' : 'success',
    source: 'google',
  };

  return {
    bookings: uniqueBookings.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)),
    dailyOccupancy,
    dailyRoomsByType,
    syncLog,
    totalRooms,
  };
}

export function parseBookingExcelBuffer(buffer: Buffer): ParsedData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return parseBookingWorkbook(workbook);
}
