import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import TicTacToe from '../games/TicTacToe'
import Connect4 from '../games/Connect4'
import Memory from '../games/Memory'
import Battleship from '../games/Battleship'
import Zsirozas from '../games/Zsirozas'
import ZsirozasMultiplayer from '../games/ZsirozasMultiplayer'
import Snapszer from '../games/Snapszer'

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const gameId = searchParams.get('game')

  const [isHost] = useState(() => sessionStorage.getItem('isHost') === 'true')
  const [opponent, setOpponent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Simulate opponent joining after 1 second (for demo)
    // This will be replaced with Firebase real-time sync
    if (isHost) {
      const timer = setTimeout(() => {
        setOpponent('Ellenfél')
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setOpponent('Host')
    }
  }, [isHost])

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderGame = () => {
    switch (gameId) {
      case 'tictactoe':
        return <TicTacToe playerSymbol={isHost ? 'X' : 'O'} />
      case 'connect4':
        return <Connect4 />
      case 'memory':
        return <Memory />
      case 'battleship':
        return <Battleship />
      case 'zsirozas':
        return <ZsirozasMultiplayer roomId={roomId || ''} isHost={isHost} />
      case 'snapszer':
        return <Snapszer />
      default:
        return <p style={{ color: '#888', textAlign: 'center' }}>Játék betöltése...</p>
    }
  }

  const gameName =
    gameId === 'tictactoe' ? '⭕ Amőba' :
    gameId === 'connect4' ? '🔵 Connect 4' :
    gameId === 'memory' ? '🃏 Memory' :
    gameId === 'battleship' ? '🚢 Torpedó' :
    gameId === 'zsirozas' ? '🌰 Zsírozás' :
    gameId === 'snapszer' ? '❤️ Snapszer' :
    'Játék'

  return (
    <div className="game-room">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <button className="back-button" onClick={() => navigate('/')} style={{ margin: 0 }}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{gameName}</h1>
        <div style={{ width: '40px' }}></div> {/* Spacer for centering */}
      </div>

      {/* Zsirozas handles its own waiting state via Firebase */}
      {(opponent || gameId === 'zsirozas') ? (
        renderGame()
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#888', fontSize: '1.2rem' }}>
            ⏳ Várakozás a másik játékosra...
          </p>
          <p style={{ color: '#667eea' }}>
            Oszd meg a szoba kódot a barátaiddal!
          </p>
        </div>
      )}

      {/* Room code at the bottom */}
      <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
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
    </div>
  )
}
