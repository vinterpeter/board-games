import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface GameHeaderProps {
  title: ReactNode
  onBack?: () => void
}

export default function GameHeader({ title, onBack }: GameHeaderProps) {
  const navigate = useNavigate()

  const handleBack = onBack || (() => navigate('/'))

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '0.5rem'
    }}>
      <button
        className="back-button"
        onClick={handleBack}
        style={{ margin: 0 }}
      >
        ←
      </button>
      <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{title}</h1>
      <div style={{ width: '40px' }}></div>
    </div>
  )
}
