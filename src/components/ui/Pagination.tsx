import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ui.css'

interface PaginationProps {
  offset: number
  limit: number
  count: number
  onChange: (offset: number) => void
}

export function Pagination({ offset, limit, count, onChange }: PaginationProps) {
  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, count)
  const canPrev = offset > 0
  const canNext = offset + limit < count

  if (count <= limit) {
    return (
      <div className="pagination">
        <span className="pagination__info">Toplam {count} kayıt</span>
      </div>
    )
  }

  return (
    <div className="pagination">
      <span className="pagination__info">
        {from}–{to} / {count} kayıt
      </span>
      <div className="pagination__controls">
        <button
          className="btn btn--secondary btn--sm"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft size={15} /> Önceki
        </button>
        <button
          className="btn btn--secondary btn--sm"
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
        >
          Sonraki <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

export default Pagination
