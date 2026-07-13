import XLSX from 'xlsx';
import type { Booking, DailyOccupancy, SyncLog, SyncMismatch } from '../types.js';

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
  syncLog: SyncLog;
  totalRooms: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthFromArrival(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return MONTHS_SHORT[d.getMonth()];
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
  if (typeof serial !== 'number' || serial < 30000) return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d?.y || !d?.m || !d?.d) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
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

function parseMonthSheet(
  sheetName: string,
  rows: Row[],
  refCounters: Map<string, number>,
  syncedAt: string,
): { bookings: Booking[]; mismatches: SyncMismatch[] } {
  const bookings: Booking[] = [];
  const mismatches: SyncMismatch[] = [];

  const dayBlockSums = new Map<number, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (isTotalRow(row)) {
      const expected = cellNumber(row[4]);
      if (expected > 0) {
        const dayDate = typeof row[1] === 'number' ? row[1] : null;
        const blockKeys = dayDate ? [dayDate] : [...dayBlockSums.keys()];
        for (const key of blockKeys) {
          const actual = dayBlockSums.get(key) ?? 0;
          if (actual !== expected) {
            const iso = excelDateToIso(key);
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

    const departureFromSheet = excelDateToIso(row[7]);
    const departureDate = departureFromSheet ?? addDays(arrivalDate, nights);

    const dayBlockDate = typeof row[1] === 'number' ? row[1] : null;
    if (dayBlockDate != null) {
      dayBlockSums.set(dayBlockDate, (dayBlockSums.get(dayBlockDate) ?? 0) + noOfRooms);
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

function buildOccupancyFromBookings(bookings: Booking[]): DailyOccupancy[] {
  const map = new Map<string, number>();

  for (const b of bookings) {
    const arrival = new Date(`${b.arrivalDate}T00:00:00`);
    const departure = new Date(`${b.departureDate}T00:00:00`);
    for (let d = new Date(arrival); d < departure; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      map.set(key, (map.get(key) ?? 0) + b.noOfRooms);
    }
  }

  return [...map.entries()]
    .map(([date, roomsOccupied]) => ({ _id: `occ-${date}`, date, roomsOccupied }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeOccupancy(sheet4: DailyOccupancy[], computed: DailyOccupancy[]): DailyOccupancy[] {
  const map = new Map<string, DailyOccupancy>();
  for (const row of computed) map.set(row.date, row);
  for (const row of sheet4) map.set(row.date, row);
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

    const { bookings, mismatches } = parseMonthSheet(sheetName, rows, refCounters, syncedAt);
    allBookings.push(...bookings);
    allMismatches.push(...mismatches);
  }

  const uniqueBookings = dedupeBookings(allBookings);
  const sheet4Occupancy = parseSheet4(workbook);
  const computedOccupancy = buildOccupancyFromBookings(uniqueBookings);
  const dailyOccupancy = mergeOccupancy(sheet4Occupancy, computedOccupancy);
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
    syncLog,
    totalRooms,
  };
}

export function parseBookingExcelBuffer(buffer: Buffer): ParsedData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return parseBookingWorkbook(workbook);
}
