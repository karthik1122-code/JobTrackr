import Column from './Column'
import { STATUSES } from '../constants'

function Board({ apps, onMove, onReject, onDelete }) {
  return (
    <div className="board">
      {STATUSES.map((status) => (
        <Column
          key={status}
          status={status}
          apps={apps.filter((a) => a.status === status)}
          onMove={onMove}
          onReject={onReject}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default Board
