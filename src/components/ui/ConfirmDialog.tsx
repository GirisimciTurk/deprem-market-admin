import type { ReactNode } from 'react'
import { Spinner } from './Spinner'
import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={loading ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner size={14} />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
      {children}
    </Modal>
  )
}

export default ConfirmDialog
