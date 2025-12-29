import { useState, useEffect, useCallback } from 'react'
import './Connect4.css'

type Cell = 'red' | 'yellow' | null
type Board = Cell[][]

const ROWS = 6
const COLS = 7

// AI Logic
const getValidColumns = (board: Board): number[] => {
  return Array.from({ length: COLS }, (_, i) => i).filter(col => board[0][col] === null)
}

const getDropRow = (board: Board, col: number): number => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r
  }
  return -1
}

const checkWinnerStatic = (board: Board, row: number, col: number, player: Cell): boolean => {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]

  for (const [dr, dc] of directions) {
    let count = 1
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) count++
      else break
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) count++
      else break
    }
    if (count >= 4) return true
  }
  return false
}

const countInDirection = (board: Board, row: number, col: number, dr: number, dc: number, player: Cell): number => {
  let count = 0
  for (let i = 1; i < 4; i++) {
    const r = row + dr * i, c = col + dc * i
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) count++
    else break
  }
  return count
}

const evaluatePosition = (board: Board, col: number, player: Cell): number => {
  const row = getDropRow(board, col)
  if (row === -1) return -1000

  const opponent = player === 'red' ? 'yellow' : 'red'
  const testBoard = board.map(r => [...r])
  testBoard[row][col] = player

  // Win = highest priority
  if (checkWinnerStatic(testBoard, row, col, player)) return 1000

  // Block opponent win
  testBoard[row][col] = opponent
  if (checkWinnerStatic(testBoard, row, col, opponent)) return 900

  // Score based on potential connections
  let score = 0
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of directions) {
    const positive = countInDirection(board, row, col, dr, dc, player)
    const negative = countInDirection(board, row, col, -dr, -dc, player)
    score += (positive + negative) * 10
  }

  // Prefer center columns
  score += (3 - Math.abs(col - 3)) * 5

  return score
}

const getAIMove = (board: Board): number => {
  const validCols = getValidColumns(board)
  if (validCols.length === 0) return -1

  let bestCol = validCols[0]
  let bestScore = -Infinity

  for (const col of validCols) {
    const score = evaluatePosition(board, col, 'yellow')
    if (score > bestScore) {
      bestScore = score
      bestCol = col
    }
  }

  return bestCol
}

export default function Connect4() {
  const [board, setBoard] = useState<Board>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  )
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'yellow'>('red')
  const [winner, setWinner] = useState<'red' | 'yellow' | 'draw' | null>(null)
  const [winningCells, setWinningCells] = useState<[number, number][]>([])
  const [vsAI, setVsAI] = useState(true)
  const [isAIThinking, setIsAIThinking] = useState(false)

  const checkWinner = (board: Board, row: number, col: number, player: Cell): [number, number][] | null => {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1],  // diagonal down-left
    ]

    for (const [dr, dc] of directions) {
      const cells: [number, number][] = [[row, col]]

      // Check in positive direction
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i
        const c = col + dc * i
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
          cells.push([r, c])
        } else break
      }

      // Check in negative direction
      for (let i = 1; i < 4; i++) {
        const r = row - dr * i
        const c = col - dc * i
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
          cells.push([r, c])
        } else break
      }

      if (cells.length >= 4) return cells
    }
    return null
  }

  const dropPiece = useCallback((col: number, player: 'red' | 'yellow') => {
    if (winner) return false

    const row = getDropRow(board, col)
    if (row === -1) return false

    const newBoard = board.map(r => [...r])
    newBoard[row][col] = player
    setBoard(newBoard)

    const winning = checkWinner(newBoard, row, col, player)
    if (winning) {
      setWinner(player)
      setWinningCells(winning)
      return true
    } else if (newBoard[0].every(cell => cell !== null)) {
      setWinner('draw')
      return true
    } else {
      setCurrentPlayer(player === 'red' ? 'yellow' : 'red')
      return true
    }
  }, [board, winner])

  const makeAIMove = useCallback(() => {
    if (winner || currentPlayer !== 'yellow') return

    setIsAIThinking(true)
    setTimeout(() => {
      const aiCol = getAIMove(board)
      if (aiCol !== -1) {
        dropPiece(aiCol, 'yellow')
      }
      setIsAIThinking(false)
    }, 600)
  }, [board, currentPlayer, winner, dropPiece])

  useEffect(() => {
    if (vsAI && currentPlayer === 'yellow' && !winner && !isAIThinking) {
      makeAIMove()
    }
  }, [vsAI, currentPlayer, winner, isAIThinking, makeAIMove])

  const handleColumnClick = (col: number) => {
    if (winner || isAIThinking) return
    if (vsAI && currentPlayer === 'yellow') return
    dropPiece(col, currentPlayer)
  }

  const resetGame = () => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)))
    setCurrentPlayer('red')
    setWinner(null)
    setWinningCells([])
    setIsAIThinking(false)
  }

  const toggleMode = () => {
    setVsAI(!vsAI)
    resetGame()
  }

  const isWinningCell = (row: number, col: number) => {
    return winningCells.some(([r, c]) => r === row && c === col)
  }

  const getStatusMessage = () => {
    if (winner === 'draw') return '🤝 Döntetlen!'
    if (winner === 'red') return vsAI ? '🎉 Te nyertél!' : '🔴 Piros nyert!'
    if (winner === 'yellow') return vsAI ? '🤖 A gép nyert!' : '🟡 Sárga nyert!'
    if (isAIThinking) return '🤖 A gép gondolkodik...'
    if (vsAI) return currentPlayer === 'red' ? '🔴 Te következel' : '🟡 Gép következik'
    return currentPlayer === 'red' ? '🔴 Piros következik' : '🟡 Sárga következik'
  }

  return (
    <div className="connect4">
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

      <div className="game-status">{getStatusMessage()}</div>

      <div className="connect4-board-container">
        <div className="connect4-column-buttons">
          {Array(COLS).fill(null).map((_, col) => (
            <button
              key={col}
              className="connect4-drop-button"
              onClick={() => handleColumnClick(col)}
              disabled={!!winner || board[0][col] !== null || isAIThinking}
            >
              ⬇️
            </button>
          ))}
        </div>

        <div className="connect4-board">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="connect4-row">
              {row.map((cell, colIndex) => (
                <div
                  key={colIndex}
                  className={`connect4-cell ${isWinningCell(rowIndex, colIndex) ? 'winning' : ''}`}
                >
                  {cell && <div className={`connect4-piece ${cell}`} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {winner && (
        <button className="btn-primary" onClick={resetGame} style={{ marginTop: '1rem' }}>
          🔄 Új játék
        </button>
      )}
    </div>
  )
}
