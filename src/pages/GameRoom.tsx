import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import TicTacToe from '../games/tictactoe'
import Connect4 from '../games/connect4'
import Memory from '../games/memory'
import Battleship from '../games/battleship'
import ZsirozasMultiplayer from '../games/zsirozas/ZsirozasMultiplayer'
import Snapszer from '../games/snapszer'
import GameHeader from '../components/GameHeader'
import RoomCode from '../components/RoomCode'
import SuitIcon from '../components/SuitIcon'

const gameNames: Record<string, React.ReactNode> = {
  tictactoe: '⭕ Amőba',
  connect4: '🔵 Connect 4',
  memory: '🃏 Memory',
  battleship: '🚢 Torpedó',
  zsirozas: <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><SuitIcon suit="acorn" size={28} /> Zsírozás</span>,
  snapszer: <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><SuitIcon suit="heart" size={28} /> Snapszer</span>,
}

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('game')

  const [isHost] = useState(() => sessionStorage.getItem('isHost') === 'true')
  const [opponent, setOpponent] = useState<string | null>(null)

  useEffect(() => {
    if (isHost) {
      const timer = setTimeout(() => {
        setOpponent('Ellenfél')
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setOpponent('Host')
    }
  }, [isHost])

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

  return (
    <div className="game-room">
      <GameHeader title={gameNames[gameId || ''] || 'Játék'} />

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

      <RoomCode roomId={roomId || ''} />
    </div>
  )
}
