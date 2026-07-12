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
} from 'recharts';
import { CupStar, GraphUp } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

export function AgentsPage() {
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
        <p className="page-subtitle">Leaderboard, room-nights, and share of business by agent</p>
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
                <tr key={agent._id}>
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
    </>
  );
}
