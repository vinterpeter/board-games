import { useState, useEffect, useCallback } from 'react'
import { usePlayerName } from '../../contexts/PlayerNameContext'
import './style.css'

interface TicTacToeProps {
  playerSymbol?: 'X' | 'O'
}

type Cell = 'X' | 'O' | null

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
]

// AI Logic
const getAIMove = (board: Cell[], aiSymbol: 'X' | 'O'): number => {
  const playerSymbol = aiSymbol === 'X' ? 'O' : 'X'
  const emptyIndices = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1)

  // 1. Win if possible
  for (const idx of emptyIndices) {
    const testBoard = [...board]
    testBoard[idx] = aiSymbol
    if (checkWinnerStatic(testBoard) === aiSymbol) return idx
  }

  // 2. Block opponent win
  for (const idx of emptyIndices) {
    const testBoard = [...board]
    testBoard[idx] = playerSymbol
    if (checkWinnerStatic(testBoard) === playerSymbol) return idx
  }

  // 3. Take center
  if (board[4] === null) return 4

  // 4. Take corners
  const corners = [0, 2, 6, 8].filter(i => board[i] === null)
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)]

  // 5. Take any available
  return emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
}

const checkWinnerStatic = (squares: Cell[]): Cell | 'draw' | null => {
  for (const [a, b, c] of winningCombinations) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]
    }
  }
  if (squares.every((cell) => cell !== null)) {
    return 'draw'
  }
  return null
}

export default function TicTacToe({ playerSymbol: _playerSymbol }: TicTacToeProps) {
  const { playerName } = usePlayerName()
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<Cell | 'draw'>(null)
  const [vsAI, setVsAI] = useState(true)
  const [isAIThinking, setIsAIThinking] = useState(false)

  const makeAIMove = useCallback(() => {
    if (winner || currentPlayer !== 'O') return

    setIsAIThinking(true)
    setTimeout(() => {
      const aiMove = getAIMove(board, 'O')
      if (aiMove !== -1 && aiMove !== undefined) {
        const newBoard = [...board]
        newBoard[aiMove] = 'O'
        setBoard(newBoard)

        const result = checkWinnerStatic(newBoard)
        if (result) {
          setWinner(result)
        } else {
          setCurrentPlayer('X')
        }
      }
      setIsAIThinking(false)
    }, 500)
  }, [board, currentPlayer, winner])

  useEffect(() => {
    if (vsAI && currentPlayer === 'O' && !winner && !isAIThinking) {
      makeAIMove()
    }
  }, [vsAI, currentPlayer, winner, isAIThinking, makeAIMove])

  const handleCellClick = (index: number) => {
    if (board[index] || winner || isAIThinking) return
    if (vsAI && currentPlayer === 'O') return

    const newBoard = [...board]
    newBoard[index] = currentPlayer
    setBoard(newBoard)

    const result = checkWinnerStatic(newBoard)
    if (result) {
      setWinner(result)
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
    }
  }

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setCurrentPlayer('X')
    setWinner(null)
    setIsAIThinking(false)
  }

  const toggleMode = () => {
    setVsAI(!vsAI)
    resetGame()
  }

  const getStatusMessage = () => {
    if (winner === 'draw') return '🤝 Döntetlen!'
    if (winner === 'X') return `🎉 ${playerName} nyertél!`
    if (winner === 'O') return vsAI ? '🤖 A gép nyert!' : '🎉 O nyert!'
    if (isAIThinking) return '🤖 A gép gondolkodik...'
    if (vsAI) return currentPlayer === 'X' ? `❌ ${playerName} következel` : '⭕ Gép következik'
    return `${currentPlayer === 'X' ? '❌' : '⭕'} ${currentPlayer} következik`
  }

  return (
    <div className="tictactoe">
      <div className="mode-toggle">
        <button
          className={vsAI ? 'active' : ''}
          onClick={() => !vsAI && toggleMode()}
        >
          🤖 Gép ellen
        </button>
        <button
          className={!vsAI ? 'active' : ''}
          onClick={() => vsAI && toggleMode()}
        >
          👥 2 játékos
        </button>
      </div>

      <div className="game-status">
        {getStatusMessage()}
      </div>

      <div className="board">
        {board.map((cell, index) => (
          <button
            key={index}
            className={`cell ${cell ? 'filled' : ''} ${cell === 'X' ? 'x' : cell === 'O' ? 'o' : ''}`}
            onClick={() => handleCellClick(index)}
            disabled={!!cell || !!winner || isAIThinking}
          >
            {cell === 'X' && '❌'}
            {cell === 'O' && '⭕'}
          </button>
        ))}
      </div>

      {winner && (
        <button className="btn-primary" onClick={resetGame} style={{ marginTop: '1rem' }}>
          🔄 Új játék
        </button>
      )}
    </div>
  )
}
