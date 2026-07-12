import type {
  Booking,
  Agent,
  DailyOccupancy,
  DashboardKPIs,
  SyncLog,
  BookingOverlap,
  GuestHistory,
  MonthlyReport,
  OccupiedByType,
} from '../types';

const BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getKPIs: () => fetchJson<DashboardKPIs>('/dashboard/kpis'),
  getOccupancy: (days = 30) => fetchJson<DailyOccupancy[]>(`/occupancy?days=${days}`),
  getTodayBookings: () =>
    fetchJson<{ arrivals: Booking[]; departures: Booking[]; occupied: OccupiedByType }>(
      '/bookings/today',
    ),
  getOccupiedByType: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return fetchJson<OccupiedByType>(`/bookings/occupied${qs}`);
  },
  getBookings: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<Booking[]>(`/bookings${qs}`);
  },
  getBooking: (id: string) => fetchJson<Booking>(`/bookings/${id}`),
  getAgents: () => fetchJson<Agent[]>('/agents'),
  getLeaderboard: () => fetchJson<Agent[]>('/agents/leaderboard'),
  getCalendar: (year: number, month: number) =>
    fetchJson<Booking[]>(`/calendar?year=${year}&month=${month}`),
  getOverlaps: () => fetchJson<BookingOverlap[]>('/overlaps'),
  getGuests: () => fetchJson<GuestHistory[]>('/guests'),
  getMonthlyReport: () => fetchJson<MonthlyReport[]>('/reports/monthly'),
  getSyncLog: () => fetchJson<SyncLog>('/sync'),
  refreshSync: () =>
    fetchJson<{ message: string; syncedAt: string }>('/sync/refresh', { method: 'POST' }),
};
