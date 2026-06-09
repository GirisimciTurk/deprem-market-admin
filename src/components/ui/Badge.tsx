import type { StatusMeta } from '../../lib/statusLabels'

export function Badge({ status }: { status: StatusMeta }) {
  return <span className={`badge badge--${status.variant}`}>{status.label}</span>
}

export default Badge
