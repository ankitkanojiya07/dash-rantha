import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export function BookingsPage() {
  const [filters, setFilters] = useState({
    agent: '',
    month: '',
    year: '',
    category: '',
    search: '',
    from: '',
    to: '',
  });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filters.agent) p.agent = filters.agent;
    if (filters.month) p.month = filters.month;
    if (filters.year) p.year = filters.year;
    if (filters.category) p.category = filters.category;
    if (filters.search) p.search = filters.search;
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    return p;
  }, [filters]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', queryParams],
    queryFn: () => api.getBookings(queryParams),
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const { data: yearOptions = [] } = useQuery({
    queryKey: ['booking-years'],
    queryFn: async () => {
      const all = await api.getBookings();
      return [...new Set(all.map((b) => b.arrivalDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
    },
    staleTime: 10 * 60 * 1000,
  });

  const table = useReactTable({
    data: bookings ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function exportCSV() {
    if (!bookings?.length) return;
    const headers = ['Ref', 'Guest', 'Room', 'Rooms', 'Agent', 'Arrival', 'Departure', 'Nights', 'Room Nights', 'Category'];
    const rows = bookings.map((b) => [
      b.bookingRef, b.guestOrGroupName, b.finalRoom, b.noOfRooms, b.agentName,
      b.arrivalDate, b.departureDate, b.nights, b.nights * b.noOfRooms, b.roomCategoryOrStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
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
          placeholder="Search guest, ref, room..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select
          className="filter-select"
          value={filters.agent}
          onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
        >
          <option value="">All Agents</option>
          {agents?.map((a) => (
            <option key={a._id} value={a.agentName}>{a.agentName}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value })}
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
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
        <button className="btn btn-ghost btn-sm" onClick={exportCSV} style={{ marginLeft: 'auto' }}>
          <Download size={14} {...ICON} />
          Export CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
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
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {bookings?.length ?? 0} bookings
        </div>
      </div>

      {selected && <BookingDetailPanel booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
