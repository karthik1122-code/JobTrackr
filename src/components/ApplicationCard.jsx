import { NEXT_STATUS } from '../constants'

function formatDate(value) {
  return new Date(value + 'T00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ApplicationCard({ app, onMove, onReject, onDelete }) {
  const next = NEXT_STATUS[app.status]

  return (
    <li className="card">
      <div className="card-top">
        <h4>{app.company}</h4>
        <span className={`priority priority-${app.priority.toLowerCase()}`}>{app.priority}</span>
      </div>
      <p className="role">{app.role}</p>
      <p className="date">Applied {formatDate(app.appliedOn)}</p>

      <div className="card-actions">
        {next && (
          <button type="button" onClick={() => onMove(app.id)}>
            Move to {next}
          </button>
        )}
        {app.status !== 'Rejected' && (
          <button type="button" className="btn-reject" onClick={() => onReject(app.id)}>
            Reject
          </button>
        )}
        <button type="button" className="btn-delete" onClick={() => onDelete(app.id)}>
          Delete
        </button>
      </div>
    </li>
  )
}

export default ApplicationCard
