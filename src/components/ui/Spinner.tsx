import './ui.css'

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Yükleniyor" />
}

export function LoadingState({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="spinner-center">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  )
}

export default Spinner
