import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { GuestHistory } from '../types';
import { BookingDetailPanel } from '../components/BookingDetail';
import { format, parseISO } from 'date-fns';
import { UsersGroupTwoRounded, Repeat } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

export function GuestsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  const { data: guests, isLoading } = useQuery({
    queryKey: ['guests'],
    queryFn: api.getGuests,
  });

  const repeatGuests = guests?.filter((g) => g.totalStays > 1) ?? [];

  if (isLoading || !guests) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading guest history...
      </div>
    );
  }

  const selectedGuest = guests.find((g) => g.guestOrGroupName === expanded);
  const booking = selectedBooking && selectedGuest
    ? selectedGuest.stays.find((s) => s._id === selectedBooking)
    : null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Guest & Group History</h1>
        <p className="page-subtitle">Repeat guests grouped by name — view past stays</p>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Guests / Groups</div>
          <div className="kpi-value">{guests.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Repeat Guests</div>
          <div className="kpi-value accent">{repeatGuests.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Repeat Rate</div>
          <div className="kpi-value">
            {guests.length > 0 ? Math.round((repeatGuests.length / guests.length) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guest / Group</th>
                <th>Total Stays</th>
                <th>Room Nights</th>
                <th>Last Stay</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <GuestRow
                  key={g.guestOrGroupName}
                  guest={g}
                  expanded={expanded === g.guestOrGroupName}
                  onToggle={() =>
                    setExpanded(expanded === g.guestOrGroupName ? null : g.guestOrGroupName)
                  }
                  onSelectBooking={setSelectedBooking}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expanded && selectedGuest && (
        <div className="card">
          <div className="card-title">
            <UsersGroupTwoRounded size={16} {...ICON} color="currentColor" style={{ display: 'inline', marginRight: 6 }} />
            Stay History — {selectedGuest.guestOrGroupName}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Room</th>
                  <th>Nights</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {selectedGuest.stays.map((s) => (
                  <tr key={s._id} onClick={() => setSelectedBooking(s._id)}>
                    <td>{s.bookingRef}</td>
                    <td>{format(parseISO(s.arrivalDate), 'dd MMM yyyy')}</td>
                    <td>{format(parseISO(s.departureDate), 'dd MMM yyyy')}</td>
                    <td>{s.finalRoom}</td>
                    <td>{s.nights}</td>
                    <td>{s.agentName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {booking && <BookingDetailPanel booking={booking} onClose={() => setSelectedBooking(null)} />}
    </>
  );
}

function GuestRow({
  guest,
  expanded,
  onToggle,
}: {
  guest: GuestHistory;
  expanded: boolean;
  onToggle: () => void;
  onSelectBooking: (id: string) => void;
}) {
  return (
    <tr onClick={onToggle} className={expanded ? 'selected' : ''}>
      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
        {guest.totalStays > 1 && (
          <Repeat size={12} {...ICON} style={{ display: 'inline', marginRight: 6, color: 'var(--accent)' }} />
        )}
        {guest.guestOrGroupName}
      </td>
      <td>
        {guest.totalStays > 1 ? (
          <span className="badge badge-accent">{guest.totalStays} stays</span>
        ) : (
          guest.totalStays
        )}
      </td>
      <td>{guest.totalRoomNights}</td>
      <td>{format(parseISO(guest.lastStay.arrivalDate), 'dd MMM yyyy')}</td>
      <td>{guest.lastStay.agentName}</td>
    </tr>
  );
}
