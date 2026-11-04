import { NEXT_STATUS } from '../constants'

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ApplicationCard({ app, busy, onMove, onReject, onDelete }) {
  const next = NEXT_STATUS[app.status]

  return (
    <li className={busy ? 'card busy' : 'card'}>
      <div className="card-top">
        <h4>{app.company}</h4>
        <span className={`priority priority-${app.priority.toLowerCase()}`}>{app.priority}</span>
      </div>
      <p className="role">{app.role}</p>
      <p className="date">
        Applied {formatDate(app.appliedOn)}
        {app.salary != null && <> · ₹{app.salary.toLocaleString('en-IN')}/mo</>}
      </p>

      <div className="card-actions">
        {next && (
          <button type="button" onClick={() => onMove(app, next)} disabled={busy}>
            Move to {next}
          </button>
        )}
        {app.status !== 'Rejected' && (
          <button type="button" className="btn-reject" onClick={() => onReject(app)} disabled={busy}>
            Reject
          </button>
        )}
        <button type="button" className="btn-delete" onClick={() => onDelete(app)} disabled={busy}>
          {busy ? '…' : 'Delete'}
        </button>
      </div>
    </li>
  )
}

export default ApplicationCard
