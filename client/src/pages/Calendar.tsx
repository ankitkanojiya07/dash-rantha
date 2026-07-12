import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Booking } from '../types';
import { BookingDetailPanel } from '../components/BookingDetail';
import { DayBookingsPanel } from '../components/DayBookingsPanel';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isToday as isDateToday,
} from 'date-fns';
import { AltArrowLeft, AltArrowRight, DangerTriangle } from '@solar-icons/react';
import { RoomsByTypeSummary } from '../components/RoomsByTypeSummary';
import { countRoomsByType } from '../utils/roomType';

const ICON = { weight: 'BoldDuotone' as const };

const AGENT_COLORS = new Map<string, number>();
let colorIdx = 0;

function getAgentColor(agent: string) {
  if (!AGENT_COLORS.has(agent)) {
    AGENT_COLORS.set(agent, colorIdx++ % 8);
  }
  return AGENT_COLORS.get(agent)!;
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selected, setSelected] = useState<Booking | null>(null);
  const [dayList, setDayList] = useState<{ date: Date; bookings: Booking[] } | null>(null);
  const [colorBy, setColorBy] = useState<'agent' | 'category'>('agent');
  const [summaryDate, setSummaryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => api.getCalendar(year, month),
  });

  const { data: overlaps } = useQuery({
    queryKey: ['overlaps'],
    queryFn: api.getOverlaps,
  });

  const { data: summaryOccupied, isLoading: summaryLoading } = useQuery({
    queryKey: ['occupied', summaryDate],
    queryFn: () => api.getOccupiedByType(summaryDate),
  });

  const isSummaryToday = isDateToday(parseISO(summaryDate));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!bookings) return map;
    for (const b of bookings) {
      const arrival = parseISO(b.arrivalDate);
      const departure = parseISO(b.departureDate);
      for (const day of days) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        if (dayStart >= arrival && dayStart < departure) {
          const key = format(day, 'yyyy-MM-dd');
          const list = map.get(key) ?? [];
          if (!list.find((x) => x._id === b._id)) list.push(b);
          map.set(key, list);
        }
      }
    }
    return map;
  }, [bookings, days]);

  const overlapIds = new Set(
    overlaps?.flatMap((o) => [o.booking1._id, o.booking2._id]) ?? []
  );

  const summaryByType = summaryOccupied?.byType ?? [];
  const summaryTotalRooms = summaryOccupied?.totalRooms ?? 0;

  const dayTypeTallies = useMemo(() => {
    const map = new Map<string, ReturnType<typeof countRoomsByType>>();
    for (const [key, dayBookings] of bookingsByDay) {
      const counts = countRoomsByType(dayBookings);
      if (counts.length > 0) map.set(key, counts);
    }
    return map;
  }, [bookingsByDay]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading calendar...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Reservation Calendar</h1>
        <p className="page-subtitle">View bookings by day — click any booking for details</p>
      </div>

      {overlaps && overlaps.length > 0 && (
        <div className="overlap-warning">
          <DangerTriangle size={16} {...ICON} color="var(--warning)" />
          {overlaps.length} room overlap{overlaps.length > 1 ? 's' : ''} detected — same room booked on overlapping dates
        </div>
      )}

      <div className="card">
        <RoomsByTypeSummary
          title={isSummaryToday ? 'Rooms Booked Today' : 'Rooms Booked'}
          dateLabel={format(parseISO(summaryDate), 'EEEE, d MMMM yyyy')}
          dateValue={summaryDate}
          onDateChange={setSummaryDate}
          totalRooms={summaryTotalRooms}
          byType={summaryByType}
          loading={summaryLoading}
        />
      </div>

      <div className="card">
        <div className="calendar-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <AltArrowLeft size={16} {...ICON} />
          </button>
          <h3>{format(currentDate, 'MMMM yyyy')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <AltArrowRight size={16} {...ICON} />
          </button>
          <select
            className="filter-select"
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as 'agent' | 'category')}
            style={{ marginLeft: 'auto' }}
          >
            <option value="agent">Color by Agent</option>
            <option value="category">Color by Category</option>
          </select>
        </div>

        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="calendar-header-cell">{d}</div>
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay.get(key) ?? [];
            const typeTally = dayTypeTallies.get(key);
            return (
              <div
                key={key}
                className={`calendar-day ${!isSameMonth(day, currentDate) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''}`}
              >
                <div className="calendar-day-number">{format(day, 'd')}</div>
                {typeTally && typeTally.length > 0 && (
                  <div className="calendar-day-type-tally">
                    {typeTally.map((t) => (
                      <span key={t.type} className="calendar-type-badge" title={`${t.type}: ${t.rooms} room(s)`}>
                        {t.type} {t.rooms}
                      </span>
                    ))}
                  </div>
                )}
                {dayBookings.slice(0, 4).map((b) => {
                  const colorClass = colorBy === 'agent'
                    ? `agent-color-${getAgentColor(b.agentName)}`
                    : `agent-color-${b.roomCategoryOrStatus.length % 8}`;
                  const isOverlap = overlapIds.has(b._id);
                  return (
                    <div
                      key={b._id}
                      className={`calendar-booking ${colorClass}`}
                      style={isOverlap ? { outline: '1px solid var(--danger)' } : undefined}
                      onClick={() => setSelected(b)}
                      title={`${b.guestOrGroupName} — ${b.finalRoom}`}
                    >
                      {b.finalRoom} {b.guestOrGroupName.split(' ')[0]}
                    </div>
                  );
                })}
                {dayBookings.length > 4 && (
                  <button
                    type="button"
                    className="calendar-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(null);
                      setDayList({ date: day, bookings: dayBookings });
                    }}
                  >
                    +{dayBookings.length - 4} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {dayList && !selected && (
        <DayBookingsPanel
          date={dayList.date}
          bookings={dayList.bookings}
          onSelect={setSelected}
          onClose={() => setDayList(null)}
        />
      )}
      {selected && (
        <BookingDetailPanel
          booking={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
