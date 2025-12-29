import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import TicTacToe from '../games/TicTacToe'
import Connect4 from '../games/Connect4'
import Memory from '../games/Memory'
import Battleship from '../games/Battleship'
import Zsirozas from '../games/Zsirozas'
import Snapszer from '../games/Snapszer'

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const gameId = searchParams.get('game')

  const [playerName] = useState(() => sessionStorage.getItem('playerName') || 'Vendég')
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
        return <Zsirozas />
      case 'snapszer':
        return <Snapszer />
      default:
        return <p style={{ color: '#888', textAlign: 'center' }}>Játék betöltése...</p>
    }
  }

  return (
    <div className="game-room">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Kilépés
      </button>

      <h1>{
        gameId === 'tictactoe' ? '⭕ Amőba' :
        gameId === 'connect4' ? '🔵 Connect 4' :
        gameId === 'memory' ? '🃏 Memory' :
        gameId === 'battleship' ? '🚢 Torpedó' :
        gameId === 'zsirozas' ? '🌰 Zsírozás' :
        gameId === 'snapszer' ? '❤️ Snapszer' :
        'Játék'
      }</h1>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <p style={{ color: '#888', margin: '0 0 0.5rem' }}>Szoba kód:</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
          <code style={{
            background: '#2d2d2d',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '1.5rem',
            letterSpacing: '0.2rem',
            color: '#667eea'
          }}>
            {roomId}
          </code>
          <button
            onClick={copyRoomCode}
            style={{
              background: copied ? '#4caf50' : '#667eea',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      <div className="player-info">
        <div className={`player ${isHost ? 'active' : ''}`}>
          {isHost ? '❌' : '⭕'} {playerName} {isHost && '(Te)'}
        </div>
        <div className={`player ${!isHost ? 'active' : ''}`}>
          {isHost ? '⭕' : '❌'} {opponent || 'Várakozás...'}
        </div>
      </div>

      {opponent ? (
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
    </div>
  )
}
