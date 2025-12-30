import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayerName } from '../contexts/PlayerNameContext'

const gameNames: Record<string, string> = {
  tictactoe: 'Amőba',
  chess: 'Sakk',
  checkers: 'Dáma',
  connect4: 'Connect 4',
  memory: 'Memory',
  battleship: 'Torpedó',
  zsirozas: 'Zsírozás',
  snapszer: 'Snapszer',
}

export default function GameLobby() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { playerName: globalPlayerName } = usePlayerName()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [localPlayerName, setLocalPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const gameName = gameNames[gameId || ''] || 'Játék'

  // Use global player name if available, otherwise use local input
  const effectivePlayerName = globalPlayerName !== 'Vendég' ? globalPlayerName : localPlayerName

  const handleCreateRoom = () => {
    if (!effectivePlayerName.trim()) return

    // Generate a simple room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Store player info in sessionStorage for now
    sessionStorage.setItem('playerName', effectivePlayerName)
    sessionStorage.setItem('isHost', 'true')

    navigate(`/room/${newRoomId}?game=${gameId}`)
  }

  const handleJoinRoom = () => {
    if (!effectivePlayerName.trim() || !roomCode.trim()) return

    sessionStorage.setItem('playerName', effectivePlayerName)
    sessionStorage.setItem('isHost', 'false')

    navigate(`/room/${roomCode.toUpperCase()}?game=${gameId}`)
  }

  // Check if we have a valid name already
  const hasValidName = globalPlayerName !== 'Vendég'

  return (
    <div className="lobby-page">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Vissza a főoldalra
      </button>

      <div className="lobby-header">
        <h1>{gameName}</h1>
        <p style={{ color: '#888' }}>Hozz létre új szobát vagy csatlakozz egy meglévőhöz!</p>
      </div>

      <div className="lobby-actions">
        <button className="btn-primary" onClick={() => hasValidName ? handleCreateRoom() : setShowCreateModal(true)}>
          ➕ Új szoba létrehozása
        </button>
        <button className="btn-secondary" onClick={() => setShowJoinModal(true)}>
          🚪 Csatlakozás szobához
        </button>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Új szoba létrehozása</h2>
            {!hasValidName && (
              <div className="input-group">
                <label>A neved:</label>
                <input
                  type="text"
                  placeholder="Add meg a neved..."
                  value={localPlayerName}
                  onChange={(e) => setLocalPlayerName(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            {hasValidName && (
              <p style={{ color: '#888', marginBottom: '1rem' }}>
                Játékos: <strong style={{ color: 'white' }}>{globalPlayerName}</strong>
              </p>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Mégse
              </button>
              <button className="btn-primary" onClick={handleCreateRoom}>
                Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Csatlakozás szobához</h2>
            {!hasValidName && (
              <div className="input-group">
                <label>A neved:</label>
                <input
                  type="text"
                  placeholder="Add meg a neved..."
                  value={localPlayerName}
                  onChange={(e) => setLocalPlayerName(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            {hasValidName && (
              <p style={{ color: '#888', marginBottom: '1rem' }}>
                Játékos: <strong style={{ color: 'white' }}>{globalPlayerName}</strong>
              </p>
            )}
            <div className="input-group">
              <label>Szoba kód:</label>
              <input
                type="text"
                placeholder="Pl. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus={hasValidName}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowJoinModal(false)}>
                Mégse
              </button>
              <button className="btn-primary" onClick={handleJoinRoom}>
                Csatlakozás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
