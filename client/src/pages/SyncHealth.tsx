import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Refresh, CheckCircle, DangerTriangle, CloseCircle } from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

export function SyncHealthPage() {
  const queryClient = useQueryClient();

  const { data: syncLog, isLoading } = useQuery({
    queryKey: ['sync'],
    queryFn: api.getSyncLog,
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshSync,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (isLoading || !syncLog) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading sync health...
      </div>
    );
  }

  const statusIcon = {
    success: <CheckCircle size={20} {...ICON} color="var(--success)" />,
    warning: <DangerTriangle size={20} {...ICON} color="var(--warning)" />,
    error: <CloseCircle size={20} {...ICON} color="var(--danger)" />,
  };

  const statusBadge = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-danger',
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Data Health</h1>
        <p className="page-subtitle">Sync status, integrity checks, and mismatch detection</p>
      </div>

      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {statusIcon[syncLog.status]}
            Sync Status
          </span>
          <span className={`badge ${statusBadge[syncLog.status]}`}>
            {syncLog.status.toUpperCase()}
          </span>
        </div>

        <div className="health-grid">
          <div className="health-stat">
            <div className="num">{syncLog.sheetsProcessed}</div>
            <div className="lbl">Sheets Processed</div>
          </div>
          <div className="health-stat">
            <div className="num">{syncLog.rowsProcessed.toLocaleString()}</div>
            <div className="lbl">Rows Processed</div>
          </div>
          <div className="health-stat">
            <div className="num" style={{ color: syncLog.mismatches.length ? 'var(--warning)' : 'var(--success)' }}>
              {syncLog.mismatches.length}
            </div>
            <div className="lbl">Mismatches</div>
          </div>
        </div>

        <div className="sync-bar">
          <span>
            Last synced: {format(parseISO(syncLog.syncedAt), 'dd MMM yyyy, HH:mm')} (
            {formatDistanceToNow(parseISO(syncLog.syncedAt), { addSuffix: true })})
            {syncLog.source ? <> · Source: Google Drive (live link)</> : null}
            {syncLog.sheetId ? <> · Sheet: {syncLog.sheetId.slice(0, 8)}…</> : null}
            {syncLog.contentHash ? <> · File #{syncLog.contentHash}</> : null}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <Refresh size={14} {...ICON} className={refreshMutation.isPending ? 'spinning' : ''} />
            Trigger Sync
          </button>
        </div>
      </div>

      {syncLog.mismatches.length > 0 && (
        <div className="card">
          <div className="card-title">
            <DangerTriangle size={16} {...ICON} color="var(--warning)" />
            TOTAL Row Mismatches
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            These dates had a mismatch between the sheet TOTAL row and the sum of individual booking room counts.
            Fix these in the shared Google Sheet / Excel and re-sync.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expected (TOTAL row)</th>
                  <th>Actual (sum of bookings)</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {syncLog.mismatches.map((m) => (
                  <tr key={m.date}>
                    <td>{format(parseISO(m.date), 'dd MMM yyyy')}</td>
                    <td>{m.expectedTotal}</td>
                    <td>{m.actualSum}</td>
                    <td>
                      <span className="badge badge-warning">
                        {m.expectedTotal - m.actualSum > 0 ? '-' : '+'}
                        {Math.abs(m.expectedTotal - m.actualSum)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Read-Only Enforcement</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { layer: 'UI Layer', desc: 'No forms or edit controls — view only', ok: true },
            { layer: 'API Layer', desc: 'No write routes except sync trigger', ok: true },
            { layer: 'Database Layer', desc: 'dashboard_reader role granted SELECT only', ok: true },
          ].map((item) => (
            <div key={item.layer} className="detail-row">
              <span className="label">{item.layer}</span>
              <span className="value">
                <CheckCircle size={14} {...ICON} color="var(--success)" style={{ display: 'inline', marginRight: 4 }} />
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
