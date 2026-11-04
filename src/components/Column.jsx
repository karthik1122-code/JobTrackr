import ApplicationCard from './ApplicationCard'

function Column({ status, apps, pendingIds, onMove, onReject, onDelete }) {
  return (
    <section className={`column column-${status.toLowerCase()}`}>
      <div className="column-head">
        <h3>{status}</h3>
        <span className="count" title="On this page">
          {apps.length}
        </span>
      </div>

      {apps.length === 0 ? (
        <p className="empty">Nothing here yet</p>
      ) : (
        <ul className="cards">
          {apps.map((app) => (
            <ApplicationCard
              key={app._id}
              app={app}
              busy={pendingIds.has(app._id)}
              onMove={onMove}
              onReject={onReject}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default Column
