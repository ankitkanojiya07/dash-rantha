import { Bed } from '@solar-icons/react';
import type { RoomTypeCount } from '../utils/roomType';

const ICON = { weight: 'BoldDuotone' as const };

const TYPE_COLORS: Record<string, string> = {
  DBL: 'room-type-dbl',
  TPL: 'room-type-tpl',
  SGL: 'room-type-sgl',
};

interface RoomsByTypeSummaryProps {
  title: string;
  dateLabel?: string;
  dateValue?: string;
  onDateChange?: (date: string) => void;
  totalRooms: number;
  byType: RoomTypeCount[];
  compact?: boolean;
  loading?: boolean;
}

export function RoomsByTypeSummary({
  title,
  dateLabel,
  dateValue,
  onDateChange,
  totalRooms,
  byType,
  compact = false,
  loading = false,
}: RoomsByTypeSummaryProps) {
  return (
    <div className={`rooms-by-type ${compact ? 'rooms-by-type-compact' : ''}`}>
      <div className="rooms-by-type-header">
        <span className="rooms-by-type-title">
          <Bed size={compact ? 14 : 16} {...ICON} color="var(--accent)" />
          {title}
        </span>
        {onDateChange && dateValue && (
          <input
            type="date"
            className="filter-input rooms-by-type-date-picker"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label="Select date"
          />
        )}
        {dateLabel && <span className="rooms-by-type-date">{dateLabel}</span>}
        <span className="badge badge-accent rooms-by-type-total">{totalRooms} rooms</span>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: compact ? '1rem' : '2rem' }}>
          <span className="spinner" style={{ marginRight: '0.5rem' }} />
          Loading...
        </div>
      ) : byType.length > 0 ? (
        <div className="room-type-grid">
          {byType.map((item) => (
            <div
              key={item.type}
              className={`room-type-chip ${TYPE_COLORS[item.type] ?? 'room-type-other'}`}
            >
              <span className="room-type-label">{item.type}</span>
              <span className="room-type-count">{item.rooms}</span>
              <span className="room-type-sub">
                {item.bookings} booking{item.bookings !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: compact ? '1rem' : '2rem' }}>
          No rooms booked for this day
        </div>
      )}
    </div>
  );
}
