import Column from './Column'
import { STATUSES } from '../constants'

function Board({ apps, pendingIds, onMove, onReject, onDelete }) {
  return (
    <div className="board">
      {STATUSES.map((status) => (
        <Column
          key={status}
          status={status}
          apps={apps.filter((a) => a.status === status)}
          pendingIds={pendingIds}
          onMove={onMove}
          onReject={onReject}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default Board
