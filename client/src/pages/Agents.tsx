import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Agent, Booking } from '../types';
import { BookingDetailPanel } from '../components/BookingDetail';
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
import { format, parseISO } from 'date-fns';
import { CloseSquare, CupStar, Download, GraphUp } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };
const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function csvEscape(value: string | number) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function AgentBookingsPanel({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Booking | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', { agent: agent.agentName }],
    queryFn: () => api.getBookings({ agent: agent.agentName }),
  });

  const chartData = useMemo(() => {
    const list = bookings ?? [];
    return MONTHS.map((month) => {
      const monthBookings = list.filter((b) => b.monthSheet === month);
      return {
        month,
        bookings: monthBookings.length,
        roomNights: monthBookings.reduce((s, b) => s + b.nights * b.noOfRooms, 0),
        rooms: monthBookings.reduce((s, b) => s + b.noOfRooms, 0),
      };
    });
  }, [bookings]);

  function exportCsv() {
    if (!bookings?.length) return;
    const headers = [
      'Ref',
      'Guest / Group',
      'Room',
      'Rooms',
      'Arrival',
      'Departure',
      'Nights',
      'Room Nights',
      'Category',
      'Month',
    ];
    const rows = bookings.map((b) => [
      b.bookingRef,
      b.guestOrGroupName,
      b.finalRoom,
      b.noOfRooms,
      b.arrivalDate,
      b.departureDate,
      b.nights,
      b.nights * b.noOfRooms,
      b.roomCategoryOrStatus,
      b.monthSheet,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.agentName.replace(/[^a-zA-Z0-9_-]+/g, '_')}-bookings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="detail-panel agent-detail-panel">
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <CloseSquare size={20} {...ICON} />
        </button>
        <h3>{agent.agentName}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          {agent.totalBookings} bookings · {agent.totalRoomNights.toLocaleString()} room nights ·{' '}
          {agent.shareOfBusiness ?? 0}% share
        </p>

        <div className="card-title" style={{ padding: 0, marginBottom: '0.75rem' }}>
          Booking chart
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!bookings?.length}>
            <Download size={14} {...ICON} />
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="loading" style={{ minHeight: 180 }}>
            <div className="spinner" />
            Loading bookings...
          </div>
        ) : (
          <>
            <div style={{ width: '100%', height: 260, marginBottom: '1.25rem' }}>
              <ResponsiveContainer width="100%" height="100%">
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

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Guest / Group</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                    <th>Rooms</th>
                    <th>Nights</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookings ?? []).map((b) => (
                    <tr key={b._id} onClick={() => setSelected(b)}>
                      <td>{b.bookingRef}</td>
                      <td>{b.guestOrGroupName}</td>
                      <td>{format(parseISO(b.arrivalDate), 'dd MMM yyyy')}</td>
                      <td>{format(parseISO(b.departureDate), 'dd MMM yyyy')}</td>
                      <td>{b.noOfRooms}</td>
                      <td>{b.nights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {selected && <BookingDetailPanel booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.getLeaderboard,
  });

  if (isLoading || !leaderboard) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading agent data...
      </div>
    );
  }

  const chartData = leaderboard.slice(0, 8).map((a) => ({
    name: a.agentName.length > 12 ? a.agentName.slice(0, 12) + '…' : a.agentName,
    roomNights: a.totalRoomNights,
    bookings: a.totalBookings,
    share: a.shareOfBusiness ?? 0,
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Agent Tracking</h1>
        <p className="page-subtitle">Leaderboard, room-nights, and share of business by agent — click an agent for the full chart</p>
      </div>

      <div className="card">
        <div className="card-title">Room Nights by Agent</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e8ecf0',
                borderRadius: 8,
                color: '#1e293b',
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              }}
            />
            <Bar dataKey="roomNights" fill="#c9a227" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Agent</th>
                <th>Bookings</th>
                <th>Room Nights</th>
                <th>Total Rooms</th>
                <th>Share of Business</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((agent, i) => (
                <tr
                  key={agent._id}
                  className={selectedAgent?._id === agent._id ? 'selected' : ''}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <td>
                    {i === 0 ? (
                      <CupStar size={16} {...ICON} color="var(--accent)" style={{ verticalAlign: 'middle' }} />
                    ) : (
                      i + 1
                    )}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{agent.agentName}</td>
                  <td>{agent.totalBookings}</td>
                  <td>{agent.totalRoomNights.toLocaleString()}</td>
                  <td>{agent.totalRooms}</td>
                  <td>
                    <span className="badge badge-accent">
                      <GraphUp size={10} {...ICON} style={{ display: 'inline', marginRight: 4 }} />
                      {agent.shareOfBusiness ?? 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAgent && (
        <AgentBookingsPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </>
  );
}
