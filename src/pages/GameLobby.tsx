import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const gameNames: Record<string, string> = {
  tictactoe: 'Amőba',
  chess: 'Sakk',
  checkers: 'Dáma',
  connect4: 'Connect 4',
  memory: 'Memory',
  battleship: 'Torpedó',
}

export default function GameLobby() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const gameName = gameNames[gameId || ''] || 'Játék'

  const handleCreateRoom = () => {
    if (!playerName.trim()) return

    // Generate a simple room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Store player info in sessionStorage for now
    sessionStorage.setItem('playerName', playerName)
    sessionStorage.setItem('isHost', 'true')

    navigate(`/room/${newRoomId}?game=${gameId}`)
  }

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return

    sessionStorage.setItem('playerName', playerName)
    sessionStorage.setItem('isHost', 'false')

    navigate(`/room/${roomCode.toUpperCase()}?game=${gameId}`)
  }

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
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
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
            <div className="input-group">
              <label>A neved:</label>
              <input
                type="text"
                placeholder="Add meg a neved..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                autoFocus
              />
            </div>
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
            <div className="input-group">
              <label>A neved:</label>
              <input
                type="text"
                placeholder="Add meg a neved..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Szoba kód:</label>
              <input
                type="text"
                placeholder="Pl. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
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
