import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type TopAgent } from '../api/client';
import { Letter, CloseSquare, CupStar } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

export function SendMailPage() {
  const [selected, setSelected] = useState<TopAgent | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents-top', 5],
    queryFn: () => api.getTopAgents(5),
  });

  function openModal(agent: TopAgent) {
    setSelected(agent);
    setEmail(agent.email || '');
    setFromDate('');
    setToDate('');
    setStatus(null);
  }

  function closeModal() {
    if (sending) return;
    setSelected(null);
    setStatus(null);
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
        Loading top agents...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Send Mail</h1>
        <p className="page-subtitle">
          Email booking CSVs to top agents for a selected date range
        </p>
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
              {agents.map((agent) => (
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
              ))}
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
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={sending}
                />
              </label>
              <label className="mail-field">
                <span>To date</span>
                <input
                  type="date"
                  className="filter-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
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
            </div>

            <p className="mail-modal-hint">
              Bookings with arrival between the selected dates will be attached as a CSV and
              sent from ranthambhoreregency@gmail.com.
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
