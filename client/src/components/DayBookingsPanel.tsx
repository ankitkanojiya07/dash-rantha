import type { Booking } from '../types';
import { CloseSquare } from '@solar-icons/react';
import { format, parseISO } from 'date-fns';

interface DayBookingsPanelProps {
  date: Date;
  bookings: Booking[];
  onSelect: (booking: Booking) => void;
  onClose: () => void;
}

export function DayBookingsPanel({ date, bookings, onSelect, onClose }: DayBookingsPanelProps) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="detail-panel">
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <CloseSquare size={20} weight="BoldDuotone" />
        </button>
        <h3>{format(date, 'd MMMM yyyy')}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
        </p>
        <div className="day-bookings-list">
          {bookings.map((b) => (
            <button
              key={b._id}
              type="button"
              className="day-booking-item"
              onClick={() => onSelect(b)}
            >
              <span className="day-booking-guest">{b.guestOrGroupName}</span>
              <span className="day-booking-meta">
                {b.finalRoom} · {b.agentName} · {b.nights}n
              </span>
              <span className="day-booking-dates">
                {format(parseISO(b.arrivalDate), 'dd MMM')} – {format(parseISO(b.departureDate), 'dd MMM')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
