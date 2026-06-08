import { FileText, Plus } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Blog() {
  return (
    <>
      <Header
        title="Blog"
        subtitle="Blog yazılarını yönet"
        actions={
          <button className="btn btn--primary">
            <Plus size={16} /> Yazı Ekle
          </button>
        }
      />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={28} style={{ color: 'var(--accent-warning)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Blog Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Blog yazıları oluştur, düzenle ve yayınla. SEO ayarlarını yönet, kategorilere ayır.
          </p>
          <button className="btn btn--primary" style={{ marginTop: '8px' }}>
            <Plus size={16} /> İlk Yazıyı Oluştur
          </button>
        </div>
      </div>
    </>
  )
}
