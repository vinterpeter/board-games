import { useState } from 'react'

interface RoomCodeProps {
  roomId: string
}

export default function RoomCode({ roomId }: RoomCodeProps) {
  const [copied, setCopied] = useState(false)

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      textAlign: 'center',
      marginTop: '1rem',
      paddingTop: '1rem',
      borderTop: '1px solid #333'
    }}>
      <span style={{ color: '#666', fontSize: '0.85rem' }}>Szoba: </span>
      <code style={{
        background: '#2d2d2d',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.85rem',
        color: '#667eea'
      }}>
        {roomId}
      </code>
      <button
        onClick={copyRoomCode}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '0.25rem',
          color: copied ? '#4caf50' : '#666',
          cursor: 'pointer',
          marginLeft: '0.25rem'
        }}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  )
}
