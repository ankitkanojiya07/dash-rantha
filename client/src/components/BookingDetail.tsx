import type { Booking } from '../types';
import { CloseSquare } from '@solar-icons/react';
import { format, parseISO } from 'date-fns';

interface BookingDetailProps {
  booking: Booking;
  onClose: () => void;
}

export function BookingDetailPanel({ booking, onClose }: BookingDetailProps) {
  const rows = [
    { label: 'Booking Ref', value: booking.bookingRef },
    { label: 'Guest / Group', value: booking.guestOrGroupName },
    { label: 'Agent', value: booking.agentName },
    { label: 'Room', value: booking.finalRoom },
    { label: 'Rooms', value: String(booking.noOfRooms) },
    { label: 'Arrival', value: format(parseISO(booking.arrivalDate), 'dd MMM yyyy') },
    { label: 'Departure', value: format(parseISO(booking.departureDate), 'dd MMM yyyy') },
    { label: 'Nights', value: String(booking.nights) },
    { label: 'Room Nights', value: String(booking.nights * booking.noOfRooms) },
    { label: 'Category', value: booking.roomCategoryOrStatus },
    { label: 'Source Sheet', value: booking.monthSheet },
    { label: 'Remarks', value: booking.remarks || '—' },
  ];

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="detail-panel">
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <CloseSquare size={20} weight="BoldDuotone" />
        </button>
        <h3>{booking.guestOrGroupName}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {booking.bookingRef}
        </p>
        {rows.map(({ label, value }) => (
          <div key={label} className="detail-row">
            <span className="label">{label}</span>
            <span className="value">{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
