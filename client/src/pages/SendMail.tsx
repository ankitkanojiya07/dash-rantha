import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type TopAgent } from '../api/client';
import { Letter, CloseSquare, CupStar, AltArrowDown } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

function GuestGroupSelect({
  agentName,
  fromDate,
  toDate,
  value,
  onChange,
  disabled,
}: {
  agentName: string;
  fromDate: string;
  toDate: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const datesReady = Boolean(fromDate && toDate && fromDate <= toDate);

  const { data: bookings, isFetching } = useQuery({
    queryKey: ['mail-guests', agentName, fromDate, toDate],
    queryFn: () =>
      api.getBookings({
        agent: agentName,
        from: fromDate,
        to: toDate,
      }),
    enabled: datesReady,
  });

  const guests = useMemo(() => {
    if (!bookings?.length) return [];
    return [...new Set(bookings.map((b) => b.guestOrGroupName.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [bookings]);

  const filteredGuests = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => g.toLowerCase().includes(q));
  }, [guests, guestSearch]);

  useEffect(() => {
    if (value && guests.length > 0 && !guests.includes(value)) {
      onChange('');
    }
  }, [guests, value, onChange]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setGuestSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const placeholder = !datesReady
    ? 'Select From and To dates first'
    : isFetching
      ? 'Loading guests…'
      : guests.length === 0
        ? 'No guests in this date range'
        : 'All guests / groups';

  return (
    <div className="guest-select" ref={rootRef}>
      <button
        type="button"
        className="filter-input guest-select-trigger"
        onClick={() => !disabled && datesReady && setOpen((v) => !v)}
        disabled={disabled || !datesReady}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={value ? 'guest-select-value' : 'guest-select-placeholder'}>
          {value || placeholder}
        </span>
        <AltArrowDown size={14} {...ICON} />
      </button>

      {open && (
        <div className="guest-select-dropdown" role="listbox">
          <input
            ref={searchRef}
            type="text"
            className="filter-input guest-select-search"
            placeholder="Search guest / group..."
            value={guestSearch}
            onChange={(e) => setGuestSearch(e.target.value)}
            aria-label="Search guest or group"
          />
          <button
            type="button"
            className={`guest-select-option ${!value ? 'active' : ''}`}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            All guests / groups
          </button>
          {filteredGuests.length === 0 ? (
            <div className="guest-select-empty">No matches</div>
          ) : (
            filteredGuests.map((g) => (
              <button
                key={g}
                type="button"
                className={`guest-select-option ${value === g ? 'active' : ''}`}
                onClick={() => {
                  onChange(g);
                  setOpen(false);
                }}
                title={g}
              >
                {g}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SendMailPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TopAgent | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [email, setEmail] = useState('');
  const [guestOrGroup, setGuestOrGroup] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents-mail-list'],
    queryFn: () => api.getTopAgents('all'),
  });

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.agentName.toLowerCase().includes(q));
  }, [agents, search]);

  function openModal(agent: TopAgent) {
    setSelected(agent);
    setEmail(agent.email || '');
    setFromDate('');
    setToDate('');
    setGuestOrGroup('');
    setStatus(null);
  }

  function closeModal() {
    if (sending) return;
    setSelected(null);
    setStatus(null);
  }

  function setFrom(value: string) {
    setFromDate(value);
    setGuestOrGroup('');
  }

  function setTo(value: string) {
    setToDate(value);
    setGuestOrGroup('');
  }

  async function handleSend() {
    if (!selected) return;
    if (!fromDate || !toDate) {
      setStatus({ type: 'err', text: 'Select both From and To dates.' });
      return;
    }
    if (fromDate > toDate) {
      setStatus({ type: 'err', text: 'From date must be on or before To date.' });
      return;
    }
    if (!email.trim()) {
      setStatus({ type: 'err', text: 'Enter the agent email address.' });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      const result = await api.sendAgentMail({
        agentName: selected.agentName,
        from: fromDate,
        to: toDate,
        email: email.trim(),
        guestOrGroup: guestOrGroup.trim() || undefined,
      });
      setStatus({
        type: 'ok',
        text: `Sent ${result.bookingCount} booking(s) to ${result.to}`,
      });
    } catch (err) {
      setStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send mail',
      });
    } finally {
      setSending(false);
    }
  }

  if (isLoading || !agents) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading agents...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Send Mail</h1>
        <p className="page-subtitle">
          Email booking CSVs to agents for a date range — optionally filter by guest/group
        </p>
      </div>

      <div className="filters-bar">
        <input
          className="filter-input"
          placeholder="Search by agent name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search agents"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredAgents.length} of {agents.length} agents
        </span>
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
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No agents match “{search}”
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <tr key={agent._id}>
                    <td>
                      {agent.rank === 1 ? (
                        <CupStar
                          size={16}
                          {...ICON}
                          color="var(--accent)"
                          style={{ verticalAlign: 'middle' }}
                        />
                      ) : (
                        agent.rank
                      )}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {agent.agentName}
                    </td>
                    <td>{agent.totalBookings}</td>
                    <td>{agent.totalRoomNights.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {agent.email || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openModal(agent)}
                      >
                        <Letter size={14} {...ICON} />
                        Send Mail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <div className="overlay" onClick={closeModal} />
          <div className="mail-modal" role="dialog" aria-modal="true" aria-labelledby="mail-modal-title">
            <button
              type="button"
              className="detail-close"
              onClick={closeModal}
              aria-label="Close"
              disabled={sending}
            >
              <CloseSquare size={22} {...ICON} />
            </button>

            <h3 id="mail-modal-title">Send Mail</h3>
            <p className="mail-modal-agent">{selected.agentName}</p>

            <div className="mail-modal-fields">
              <label className="mail-field">
                <span>From date</span>
                <input
                  type="date"
                  className="filter-input"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={sending}
                />
              </label>
              <label className="mail-field">
                <span>To date</span>
                <input
                  type="date"
                  className="filter-input"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={sending}
                />
              </label>
              <label className="mail-field mail-field-full">
                <span>Agent email</span>
                <input
                  type="email"
                  className="filter-input"
                  placeholder="agent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                />
              </label>
              <label className="mail-field mail-field-full">
                <span>Guest / Group (optional)</span>
                <GuestGroupSelect
                  agentName={selected.agentName}
                  fromDate={fromDate}
                  toDate={toDate}
                  value={guestOrGroup}
                  onChange={setGuestOrGroup}
                  disabled={sending}
                />
              </label>
            </div>

            <p className="mail-modal-hint">
              Pick From and To dates first — Guest / Group options load from that agent&apos;s
              bookings in the range. Leave Guest / Group as “All” to include every booking.
            </p>

            {status && (
              <div className={`mail-status mail-status-${status.type}`}>{status.text}</div>
            )}

            <div className="mail-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={sending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending}
              >
                <Letter size={16} {...ICON} />
                {sending ? 'Sending…' : 'Send CSV Mail'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
