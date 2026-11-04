function Pagination({ page, totalPages, total, onChange, disabled }) {
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}>
        ← Previous
      </button>
      <span>
        Page {page} of {totalPages} <span className="muted">({total} total)</span>
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={disabled || page >= totalPages}>
        Next →
      </button>
    </nav>
  )
}

export default Pagination
