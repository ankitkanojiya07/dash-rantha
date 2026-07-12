import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Download } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

export function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['monthly-report'],
    queryFn: api.getMonthlyReport,
  });

  if (isLoading || !report) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading reports...
      </div>
    );
  }

  const chartData = report.map((m) => ({
    month: m.month,
    bookings: m.bookings,
    roomNights: m.roomNights,
    rooms: m.rooms,
  }));

  const monthDetail = selectedMonth
    ? report.find((m) => m.month === selectedMonth)
    : null;

  function exportCSV() {
    if (!report) return;
    const headers = ['Month', 'Bookings', 'Room Nights', 'Rooms'];
    const rows = report.map((m) => [m.month, m.bookings, m.roomNights, m.rooms]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monthly-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = report.reduce(
    (acc, m) => ({
      bookings: acc.bookings + m.bookings,
      roomNights: acc.roomNights + m.roomNights,
      rooms: acc.rooms + m.rooms,
    }),
    { bookings: 0, roomNights: 0, rooms: 0 }
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <p className="page-subtitle">Monthly business summary — bookings, room-nights, and breakdowns</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Bookings</div>
          <div className="kpi-value">{totals.bookings.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Room Nights</div>
          <div className="kpi-value accent">{totals.roomNights.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Rooms Booked</div>
          <div className="kpi-value">{totals.rooms.toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Monthly Overview
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
            <Download size={14} {...ICON} />
            Export CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e8ecf0',
                borderRadius: 8,
                color: '#1e293b',
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              }}
            />
            <Legend />
            <Bar dataKey="bookings" fill="#c9a227" name="Bookings" radius={[4, 4, 0, 0]} />
            <Bar dataKey="roomNights" fill="#94a3b8" name="Room Nights" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '1rem 1.5rem 0' }}>Monthly Summary</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Bookings</th>
                  <th>Room Nights</th>
                  <th>Rooms</th>
                </tr>
              </thead>
              <tbody>
                {report.map((m) => (
                  <tr
                    key={m.month}
                    className={selectedMonth === m.month ? 'selected' : ''}
                    onClick={() => setSelectedMonth(m.month === selectedMonth ? '' : m.month)}
                  >
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.month}</td>
                    <td>{m.bookings}</td>
                    <td>{m.roomNights}</td>
                    <td>{m.rooms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {monthDetail && (
          <div className="card">
            <div className="card-title">{monthDetail.month} — Breakdown</div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>By Agent</h4>
            {monthDetail.byAgent.map((a) => (
              <div key={a.agentName} className="detail-row">
                <span className="label">{a.agentName}</span>
                <span className="value">{a.bookings} bookings · {a.roomNights} RN</span>
              </div>
            ))}
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '1rem 0 0.75rem' }}>By Category</h4>
            {monthDetail.byCategory.map((c) => (
              <div key={c.category} className="detail-row">
                <span className="label">{c.category}</span>
                <span className="value">{c.bookings} bookings · {c.roomNights} RN</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
