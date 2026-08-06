import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { format, parseISO, formatDistanceToNow, isToday as isDateToday } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Refresh,
  CalendarMark,
  Chart2,
  ClockCircle,
  Logout,
  DocumentText,
} from '@solar-icons/react';
import { RoomsByTypeSummary } from '../components/RoomsByTypeSummary';

const ICON = { weight: 'BoldDuotone' as const };

const SHEET_LINKS = [
  {
    label: 'BOOKING SHEET',
    href: 'https://docs.google.com/spreadsheets/d/13SZlTcgHOrZuD7L9EnSnjADz-3dRbT6C-99Lrz9w6EM/edit?gid=1292951595#gid=1292951595',
  },
  {
    label: 'safari BOOKING',
    href: 'https://docs.google.com/spreadsheets/d/1eJyaXG_K6uoYrlULtKAM_Pdx6q69qB5FpJ_6ifS9w0M/edit?gid=1837021078#gid=1837021078',
  },
] as const;

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [occupiedDate, setOccupiedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const {
    data: kpis,
    isLoading: kpisLoading,
    isError: kpisError,
    error: kpisErrorDetail,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ['kpis'],
    queryFn: api.getKPIs,
    retry: 2,
  });

  const { data: occupancy } = useQuery({
    queryKey: ['occupancy', 30],
    queryFn: () => api.getOccupancy(30),
  });

  const { data: today } = useQuery({
    queryKey: ['today'],
    queryFn: api.getTodayBookings,
  });

  const { data: occupied, isLoading: occupiedLoading } = useQuery({
    queryKey: ['occupied', occupiedDate],
    queryFn: () => api.getOccupiedByType(occupiedDate),
  });

  const occupiedDateLabel = format(parseISO(occupiedDate), 'EEEE, d MMMM yyyy');
  const isOccupiedToday = isDateToday(parseISO(occupiedDate));

  const refreshMutation = useMutation({
    mutationFn: api.refreshSync,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  if (kpisLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading dashboard...
      </div>
    );
  }

  if (kpisError || !kpis) {
    return (
      <div className="loading">
        <p>Could not load dashboard data.</p>
        <p className="page-subtitle" style={{ marginTop: 8 }}>
          {kpisErrorDetail instanceof Error ? kpisErrorDetail.message : 'API request failed'}
        </p>
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => refetchKpis()}>
          Retry
        </button>
      </div>
    );
  }

  const chartData = occupancy?.map((o) => ({
    date: format(parseISO(o.date), 'dd MMM'),
    occupancy: o.occupancyPct ?? Math.round((o.roomsOccupied / kpis.totalRooms) * 100),
    rooms: o.roomsOccupied,
  }));

  return (
    <>
      <div className="page-header page-header-row">
        <div>
          <h1 className="page-title">Live Dashboard</h1>
          <p className="page-subtitle">Real-time overview of hotel bookings and occupancy</p>
        </div>
        <div className="sheet-tabs" role="tablist" aria-label="Booking sheets">
          {SHEET_LINKS.map((sheet) => (
            <a
              key={sheet.label}
              href={sheet.href}
              target="_blank"
              rel="noopener noreferrer"
              className="sheet-tab"
              role="tab"
            >
              <DocumentText size={15} {...ICON} />
              {sheet.label}
            </a>
          ))}
        </div>
      </div>

      <div className="sync-bar">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ClockCircle size={14} {...ICON} color="var(--text-muted)" />
          Last synced: {formatDistanceToNow(parseISO(kpis.lastSyncAt), { addSuffix: true })}
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <Refresh size={14} {...ICON} className={refreshMutation.isPending ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      <div className="card">
        <RoomsByTypeSummary
          title={isOccupiedToday ? 'Rooms Booked Today' : 'Rooms Booked'}
          dateLabel={occupiedDateLabel}
          dateValue={occupiedDate}
          onDateChange={setOccupiedDate}
          totalRooms={occupied?.totalRooms ?? 0}
          byType={occupied?.byType ?? []}
          loading={occupiedLoading}
        />
      </div>

      <div className="card">
        <div className="card-title">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Chart2 size={16} {...ICON} color="currentColor" />
            Occupancy Trend — Last 30 Days
          </span>
          <span className="badge badge-accent">{kpis.totalRooms} total rooms</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e8ecf0',
                borderRadius: 8,
                color: '#1e293b',
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              }}
              formatter={(value: number, name: string) => [
                name === 'occupancy' ? `${value}%` : value,
                name === 'occupancy' ? 'Occupancy' : 'Rooms',
              ]}
            />
            <Area
              type="monotone"
              dataKey="occupancy"
              stroke="#c9a227"
              fill="url(#occGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarMark size={16} {...ICON} color="currentColor" />
              Arrivals Today
            </span>
            <span className="badge badge-accent">{today?.arrivals.length ?? 0}</span>
          </div>
          {today?.arrivals.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Agent</th>
                    <th>Nights</th>
                  </tr>
                </thead>
                <tbody>
                  {today.arrivals.slice(0, 8).map((b) => (
                    <tr key={b._id}>
                      <td>{b.guestOrGroupName}</td>
                      <td>{b.finalRoom}</td>
                      <td>{b.agentName}</td>
                      <td>{b.nights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No arrivals scheduled for today</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Logout size={16} {...ICON} color="currentColor" />
              Departures Today
            </span>
            <span className="badge badge-accent">{today?.departures.length ?? 0}</span>
          </div>
          {today?.departures.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Agent</th>
                    <th>Nights</th>
                  </tr>
                </thead>
                <tbody>
                  {today.departures.slice(0, 8).map((b) => (
                    <tr key={b._id}>
                      <td>{b.guestOrGroupName}</td>
                      <td>{b.finalRoom}</td>
                      <td>{b.agentName}</td>
                      <td>{b.nights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No departures scheduled for today</div>
          )}
        </div>
      </div>
    </>
  );
}
