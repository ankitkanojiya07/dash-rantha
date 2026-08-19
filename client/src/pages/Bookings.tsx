import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { api } from '../api/client';
import type { Booking } from '../types';
import { BookingDetailPanel } from '../components/BookingDetail';
import { format, parseISO } from 'date-fns';
import { Download } from '@solar-icons/react';
import {
  ROOM_THRESHOLDS,
  bookingMatchesSearch,
  parseBookingSearch,
} from '../utils/bookingSearch';

const ICON = { weight: 'BoldDuotone' as const };

const columnHelper = createColumnHelper<Booking>();

const columns = [
  columnHelper.accessor('bookingRef', { header: 'Ref', size: 100 }),
  columnHelper.accessor('guestOrGroupName', { header: 'Guest / Group' }),
  columnHelper.accessor('finalRoom', { header: 'Room' }),
  columnHelper.accessor('noOfRooms', { header: 'Rooms' }),
  columnHelper.accessor('agentName', { header: 'Agent' }),
  columnHelper.accessor('arrivalDate', {
    header: 'Arrival',
    cell: (info) => format(parseISO(info.getValue()), 'dd MMM yyyy'),
  }),
  columnHelper.accessor('departureDate', {
    header: 'Departure',
    cell: (info) => format(parseISO(info.getValue()), 'dd MMM yyyy'),
  }),
  columnHelper.accessor('nights', { header: 'Nights' }),
  columnHelper.accessor((row) => row.nights * row.noOfRooms, {
    id: 'roomNights',
    header: 'Room Nights',
  }),
  columnHelper.accessor('roomCategoryOrStatus', { header: 'Category' }),
  columnHelper.accessor('monthSheet', { header: 'Month' }),
];

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function csvEscape(value: string | number) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BookingsPage() {
  const [filters, setFilters] = useState({
    agent: '',
    month: '',
    year: '',
    category: '',
    search: '',
    from: '',
    to: '',
    maxRooms: '',
  });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [focusDate, setFocusDate] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filters.agent) p.agent = filters.agent;
    if (filters.month) p.month = filters.month;
    if (filters.year) p.year = filters.year;
    if (filters.category) p.category = filters.category;
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    return p;
  }, [filters.agent, filters.month, filters.year, filters.category, filters.from, filters.to]);

  const { data: bookings, isLoading, isFetching } = useQuery({
    queryKey: ['bookings', queryParams],
    queryFn: () => api.getBookings(queryParams),
    placeholderData: keepPreviousData,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const { data: occupancyAll = [] } = useQuery({
    queryKey: ['occupancy', 'all'],
    queryFn: () => api.getOccupancy('all'),
    staleTime: 10 * 60 * 1000,
  });

  const parsedSearch = useMemo(() => parseBookingSearch(filters.search), [filters.search]);

  const maxRooms = useMemo(() => {
    const fromSelect = filters.maxRooms ? Number(filters.maxRooms) : null;
    return fromSelect || parsedSearch.maxRooms;
  }, [filters.maxRooms, parsedSearch.maxRooms]);

  const lowOccupancyDates = useMemo(() => {
    if (!maxRooms) return [];
    return occupancyAll
      .filter((o) => o.roomsOccupied < maxRooms)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [occupancyAll, maxRooms]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    occupancyAll.forEach((o) => years.add(o.date.slice(0, 4)));
    bookings?.forEach((b) => years.add(b.arrivalDate.slice(0, 4)));
    years.delete('2025');
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [occupancyAll, bookings]);

  const categoryOptions = useMemo(() => {
    const byKey = new Map<string, { name: string; count: number }>();
    bookings?.forEach((b) => {
      const name = b.roomCategoryOrStatus?.trim();
      if (!name) return;
      const key = name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[.,/_|+'’`-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { name, count: 1 });
        return;
      }
      existing.count += 1;
      if (name.length < existing.name.length) existing.name = name;
    });
    return [...byKey.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => x.name);
  }, [bookings]);

  const displayed = useMemo(() => {
    let rows = bookings ?? [];
    if (focusDate) {
      rows = rows.filter((b) => b.arrivalDate <= focusDate && b.departureDate > focusDate);
    }
    rows = rows.filter((b) => bookingMatchesSearch(b, parsedSearch));
    return rows;
  }, [bookings, parsedSearch, focusDate]);

  const table = useReactTable({
    data: displayed,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function exportBookingsCsv() {
    if (!displayed.length) return;
    const headers = [
      'Ref',
      'Guest / Group',
      'Room',
      'Rooms',
      'Agent',
      'Arrival',
      'Departure',
      'Nights',
      'Room Nights',
      'Category',
      'Month',
      'Remarks',
    ];
    const rows = displayed.map((b) => [
      b.bookingRef,
      b.guestOrGroupName,
      b.finalRoom,
      b.noOfRooms,
      b.agentName,
      b.arrivalDate,
      b.departureDate,
      b.nights,
      b.nights * b.noOfRooms,
      b.roomCategoryOrStatus,
      b.monthSheet,
      b.remarks,
    ]);
    const suffix = [
      filters.agent,
      filters.month,
      filters.year,
      maxRooms ? `under${maxRooms}` : '',
      focusDate,
    ]
      .filter(Boolean)
      .join('-')
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    downloadCsv(`bookings-export${suffix ? `-${suffix}` : ''}.csv`, headers, rows);
  }

  function exportOccupancyCsv() {
    if (!lowOccupancyDates.length || !maxRooms) return;
    downloadCsv(
      `dates-under-${maxRooms}-rooms.csv`,
      ['Date', 'Rooms Booked'],
      lowOccupancyDates.map((d) => [d.date, d.roomsOccupied]),
    );
  }

  if (isLoading && !bookings) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading bookings...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Bookings</h1>
        <p className="page-subtitle">Full booking table with filters and room-night calculations</p>
      </div>

      <div className="filters-bar">
        <input
          className="filter-input"
          type="search"
          placeholder="Search guest, ref, dates… e.g. 3 November or less than 40"
          value={filters.search}
          onChange={(e) => {
            setFocusDate(null);
            setFilters({ ...filters, search: e.target.value });
          }}
          aria-label="Search bookings"
        />
        <select
          className="filter-select"
          value={filters.maxRooms}
          onChange={(e) => {
            setFocusDate(null);
            setFilters({ ...filters, maxRooms: e.target.value });
          }}
          aria-label="Days with fewer than this many rooms"
        >
          <option value="">Any occupancy</option>
          {ROOM_THRESHOLDS.map((n) => (
            <option key={n} value={n}>
              Fewer than {n} rooms
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.agent}
          onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
        >
          <option value="">All Agents</option>
          {agents?.map((a) => (
            <option key={a._id} value={a.agentName}>
              {a.agentName}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value })}
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="filter-date">
          <span>From</span>
          <input
            type="date"
            className="filter-input"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            aria-label="From date"
          />
        </label>
        <label className="filter-date">
          <span>To</span>
          <input
            type="date"
            className="filter-input"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            aria-label="To date"
          />
        </label>
        <button className="btn btn-ghost btn-sm" onClick={exportBookingsCsv} style={{ marginLeft: 'auto' }}>
          <Download size={14} {...ICON} />
          Export CSV
        </button>
      </div>

      {maxRooms ? (
        <div className="card occupancy-dates-card">
          <div className="card-title">
            <span>Dates with fewer than {maxRooms} rooms booked</span>
            <span className="badge badge-accent">{lowOccupancyDates.length} days</span>
            {lowOccupancyDates.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportOccupancyCsv}>
                <Download size={14} {...ICON} />
                Export dates CSV
              </button>
            )}
          </div>
          {lowOccupancyDates.length === 0 ? (
            <div className="empty-state">No dates found under {maxRooms} rooms</div>
          ) : (
            <div className="occupancy-dates-grid">
              {lowOccupancyDates.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className={`occupancy-date-chip ${focusDate === d.date ? 'active' : ''}`}
                  onClick={() => setFocusDate(focusDate === d.date ? null : d.date)}
                >
                  <span>{format(parseISO(d.date), 'd MMM yyyy')}</span>
                  <strong>{d.roomsOccupied} rooms</strong>
                </button>
              ))}
            </div>
          )}
          {focusDate && (
            <p className="occupancy-dates-hint">
              Showing bookings in-house on {format(parseISO(focusDate), 'd MMMM yyyy')}. Click the date again to
              clear.
            </p>
          )}
        </div>
      ) : null}

      <div className={`card ${isFetching ? 'is-fetching' : ''}`} style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      style={{ cursor: 'pointer' }}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No bookings match the current filters
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} onClick={() => setSelected(row.original)}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {displayed.length} bookings
        </div>
      </div>

      {selected && <BookingDetailPanel booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
