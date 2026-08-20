import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { Agent, Booking } from '../types';
import { BookingDetailPanel } from '../components/BookingDetail';
import { format, parseISO } from 'date-fns';
import { AltArrowDown, Download } from '@solar-icons/react';
import {
  ROOM_THRESHOLDS,
  bookingMatchesSearch,
  parseBookingSearch,
} from '../utils/bookingSearch';

const ICON = { weight: 'BoldDuotone' as const };

function AgentFilterSelect({
  agents,
  value,
  onChange,
}: {
  agents: Agent[];
  value: string[];
  onChange: (agentNames: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.agentName.localeCompare(b.agentName, undefined, { sensitivity: 'base' })),
    [agents],
  );

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedAgents;
    return sortedAgents.filter((a) => a.agentName.toLowerCase().includes(q));
  }, [sortedAgents, search]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function toggleAgent(name: string) {
    if (selectedSet.has(name)) onChange(value.filter((n) => n !== name));
    else onChange([...value, name].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  }

  function clearAgents() {
    onChange([]);
  }

  const label =
    value.length === 0
      ? 'All Agents'
      : value.length === 1
        ? value[0]
        : `${value.length} agents selected`;

  return (
    <div className="agent-filter" ref={rootRef}>
      <button
        type="button"
        className="filter-input agent-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter by agent"
      >
        <span className={value.length ? 'guest-select-value' : 'guest-select-placeholder'}>{label}</span>
        <AltArrowDown size={14} {...ICON} />
      </button>

      {open && (
        <div className="agent-filter-dropdown" role="listbox" aria-multiselectable="true">
          <input
            ref={searchRef}
            type="search"
            className="filter-input guest-select-search"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search agents"
          />
          <button
            type="button"
            className={`guest-select-option ${value.length === 0 ? 'active' : ''}`}
            onClick={clearAgents}
          >
            All Agents
          </button>
          {filteredAgents.length === 0 ? (
            <div className="guest-select-empty">No agents match “{search}”</div>
          ) : (
            filteredAgents.map((a) => {
              const checked = selectedSet.has(a.agentName);
              return (
                <button
                  key={a._id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className={`guest-select-option ${checked ? 'active' : ''}`}
                  onClick={() => toggleAgent(a.agentName)}
                >
                  <span className={`guest-check ${checked ? 'on' : ''}`} aria-hidden>
                    {checked ? '✓' : ''}
                  </span>
                  {a.agentName}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

type DateFilterMode = 'single' | 'range';

const HOTEL_TIMEZONE = 'Asia/Kolkata';

/** YYYY-MM-DD in the hotel timezone. */
function hotelTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Last calendar day of month (month is 1–12). */
function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Default bookings window: start of current month → end of next month (hotel TZ). */
function getDefaultDateRange(now = new Date()) {
  const today = hotelTodayIso(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const from = `${year}-${pad2(month)}-01`;
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const to = `${nextYear}-${pad2(nextMonth)}-${pad2(lastDayOfMonth(nextYear, nextMonth))}`;
  return { from, to };
}

function formatDateLabel(iso: string) {
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

function DateFilterSelect({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateFilterMode>(() =>
    from && to && from === to ? 'single' : from || to ? 'range' : 'range',
  );
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftSingle, setDraftSingle] = useState(from && to && from === to ? from : from || to || '');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const isSingle = Boolean(from && to && from === to);
    setMode(isSingle ? 'single' : 'range');
    setDraftFrom(from);
    setDraftTo(to);
    setDraftSingle(isSingle ? from : from || to || '');
  }, [open, from, to]);

  const isDefaultRange = from === defaultRange.from && to === defaultRange.to;

  const label = useMemo(() => {
    if (!from && !to) return 'Any date';
    if (isDefaultRange) {
      return `Upcoming (${format(parseISO(from), 'MMM')} – ${format(parseISO(to), 'MMM yyyy')})`;
    }
    if (from && to && from === to) return formatDateLabel(from);
    if (from && to) return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
    if (from) return `From ${formatDateLabel(from)}`;
    return `Until ${formatDateLabel(to)}`;
  }, [from, to, isDefaultRange]);

  const hasDateFilter = Boolean(from || to);

  function applySingle() {
    if (!draftSingle) return;
    onChange({ from: draftSingle, to: draftSingle });
    setOpen(false);
  }

  function applyRange() {
    if (!draftFrom && !draftTo) return;
    if (draftFrom && draftTo && draftFrom > draftTo) return;
    onChange({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  function resetToUpcoming() {
    onChange({ ...defaultRange });
    setDraftFrom(defaultRange.from);
    setDraftTo(defaultRange.to);
    setDraftSingle('');
    setMode('range');
    setOpen(false);
  }

  return (
    <div className="agent-filter date-filter" ref={rootRef}>
      <button
        type="button"
        className="filter-input agent-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filter by date"
      >
        <span className={hasDateFilter ? 'guest-select-value' : 'guest-select-placeholder'}>{label}</span>
        <AltArrowDown size={14} {...ICON} />
      </button>

      {open && (
        <div className="agent-filter-dropdown date-filter-dropdown" role="dialog" aria-label="Date filter">
          <div className="date-filter-tabs" role="tablist" aria-label="Date filter mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'single'}
              className={`date-filter-tab ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >
              Single date
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'range'}
              className={`date-filter-tab ${mode === 'range' ? 'active' : ''}`}
              onClick={() => setMode('range')}
            >
              From – To
            </button>
            <button
              type="button"
              className={`date-filter-tab date-filter-tab-clear ${isDefaultRange ? 'active' : ''}`}
              onClick={resetToUpcoming}
            >
              Upcoming
            </button>
          </div>

          {mode === 'single' ? (
            <div className="date-filter-body">
              <label className="date-filter-field">
                <span>Date</span>
                <input
                  type="date"
                  className="filter-input"
                  value={draftSingle}
                  onChange={(e) => setDraftSingle(e.target.value)}
                  aria-label="Single date"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!draftSingle}
                onClick={applySingle}
              >
                Apply
              </button>
            </div>
          ) : (
            <div className="date-filter-body">
              <label className="date-filter-field">
                <span>From</span>
                <input
                  type="date"
                  className="filter-input"
                  value={draftFrom}
                  max={draftTo || undefined}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  aria-label="From date"
                />
              </label>
              <label className="date-filter-field">
                <span>To</span>
                <input
                  type="date"
                  className="filter-input"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(e) => setDraftTo(e.target.value)}
                  aria-label="To date"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={(!draftFrom && !draftTo) || Boolean(draftFrom && draftTo && draftFrom > draftTo)}
                onClick={applyRange}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function createEmptyFilters() {
  const { from, to } = getDefaultDateRange();
  return {
    agents: [] as string[],
    month: '',
    year: '',
    category: '',
    search: '',
    from,
    to,
    maxRooms: '',
  };
}

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
  const [filters, setFilters] = useState(createEmptyFilters);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'arrivalDate', desc: false }]);
  const [focusDate, setFocusDate] = useState<string | null>(null);

  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
  const isDefaultDateRange =
    filters.from === defaultDateRange.from && filters.to === defaultDateRange.to;

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filters.agents.length) p.agent = filters.agents.join('|');
    if (filters.month) p.month = filters.month;
    if (filters.year) p.year = filters.year;
    if (filters.category) p.category = filters.category;
    // Month/year sheet filters replace the default upcoming date window
    if (!filters.month && !filters.year) {
      if (filters.from) p.from = filters.from;
      if (filters.to) p.to = filters.to;
    }
    return p;
  }, [filters.agents, filters.month, filters.year, filters.category, filters.from, filters.to]);

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
    const useDateWindow = !filters.month && !filters.year;
    const fromDate = useDateWindow ? filters.from || null : null;
    const toDate = useDateWindow ? filters.to || null : null;
    return occupancyAll
      .filter((o) => {
        if (o.roomsOccupied >= maxRooms) return false;
        if (fromDate && o.date < fromDate) return false;
        if (toDate && o.date > toDate) return false;
        if (filters.year && !o.date.startsWith(filters.year)) return false;
        if (filters.month) {
          const monthName = format(parseISO(o.date), 'MMM');
          if (monthName !== filters.month) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [occupancyAll, maxRooms, filters.from, filters.to, filters.month, filters.year]);

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
      filters.agents.length ? filters.agents.join('+') : '',
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

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.agents.length ||
          filters.month ||
          filters.year ||
          filters.category ||
          filters.search ||
          filters.maxRooms ||
          focusDate ||
          !isDefaultDateRange,
      ),
    [filters, focusDate, isDefaultDateRange],
  );

  function clearAllFilters() {
    setFilters(createEmptyFilters());
    setFocusDate(null);
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
        <AgentFilterSelect
          agents={agents ?? []}
          value={filters.agents}
          onChange={(nextAgents) => setFilters({ ...filters, agents: nextAgents })}
        />
        <DateFilterSelect
          from={filters.from}
          to={filters.to}
          onChange={({ from, to }) => {
            setFocusDate(null);
            setFilters({ ...filters, from, to });
          }}
        />
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
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
            Clear filters
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={exportBookingsCsv} style={{ marginLeft: 'auto' }}>
          <Download size={14} {...ICON} />
          Export CSV
        </button>
      </div>

      {maxRooms ? (
        <div className="card occupancy-dates-card">
          <div className="card-title">
            <span>
              Dates with fewer than {maxRooms} rooms booked
              {!filters.month && !filters.year && (filters.from || filters.to)
                ? filters.from && filters.to && filters.from === filters.to
                  ? ` on ${formatDateLabel(filters.from)}`
                  : filters.from && filters.to
                    ? ` (${formatDateLabel(filters.from)} – ${formatDateLabel(filters.to)})`
                    : filters.from
                      ? ` from ${formatDateLabel(filters.from)}`
                      : ` until ${formatDateLabel(filters.to)}`
                : filters.month || filters.year
                  ? ` (${[filters.month, filters.year].filter(Boolean).join(' ')})`
                  : ''}
            </span>
            <span className="badge badge-accent">{lowOccupancyDates.length} days</span>
            {lowOccupancyDates.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportOccupancyCsv}>
                <Download size={14} {...ICON} />
                Export dates CSV
              </button>
            )}
          </div>
          {lowOccupancyDates.length === 0 ? (
            <div className="empty-state">
              No dates found under {maxRooms} rooms
              {!filters.month && !filters.year && (filters.from || filters.to)
                ? ' in the selected date filter'
                : filters.month || filters.year
                  ? ' for the selected month/year'
                  : ''}
            </div>
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
