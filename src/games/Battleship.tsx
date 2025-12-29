import { useState, useCallback, useRef } from 'react'
import { usePlayerName } from '../contexts/PlayerNameContext'
import './Battleship.css'

type CellState = 'empty' | 'ship' | 'hit' | 'miss'
type Board = CellState[][]
type AIMode = 'hunt' | 'target'

const BOARD_SIZE = 10
const SHIPS = [
  { name: 'Hordozó', size: 5 },
  { name: 'Csatahajó', size: 4 },
  { name: 'Cirkáló', size: 3 },
  { name: 'Tengeralattjáró', size: 3 },
  { name: 'Romboló', size: 2 },
]

interface AIState {
  mode: AIMode
  targetQueue: [number, number][]
  lastHit: [number, number] | null
  hitChain: [number, number][]
}

const createEmptyBoard = (): Board =>
  Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'))

const canPlaceShip = (
  board: Board,
  row: number,
  col: number,
  size: number,
  horizontal: boolean
): boolean => {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i
    const c = horizontal ? col + i : col
    if (r >= BOARD_SIZE || c >= BOARD_SIZE || board[r][c] !== 'empty') {
      return false
    }
  }
  return true
}

const placeShipRandomly = (board: Board, size: number): Board => {
  const newBoard = board.map(row => [...row])
  let placed = false
  let attempts = 0

  while (!placed && attempts < 100) {
    const horizontal = Math.random() > 0.5
    const row = Math.floor(Math.random() * BOARD_SIZE)
    const col = Math.floor(Math.random() * BOARD_SIZE)

    if (canPlaceShip(newBoard, row, col, size, horizontal)) {
      for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i
        const c = horizontal ? col + i : col
        newBoard[r][c] = 'ship'
      }
      placed = true
    }
    attempts++
  }

  return newBoard
}

const createBoardWithShips = (): Board => {
  let board = createEmptyBoard()
  for (const ship of SHIPS) {
    board = placeShipRandomly(board, ship.size)
  }
  return board
}

const countRemainingShips = (board: Board): number => {
  return board.flat().filter(cell => cell === 'ship').length
}

export default function Battleship() {
  const { playerName } = usePlayerName()
  const [enemyBoard, setEnemyBoard] = useState<Board>(() => createBoardWithShips())
  const [playerBoard, setPlayerBoard] = useState<Board>(() => createBoardWithShips())
  const [playerShots, setPlayerShots] = useState<Board>(() => createEmptyBoard())
  const [enemyShots, setEnemyShots] = useState<Board>(() => createEmptyBoard())
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameOver, setGameOver] = useState<'player' | 'enemy' | null>(null)
  const [message, setMessage] = useState('Kattints az ellenség táblájára!')

  const aiStateRef = useRef<AIState>({
    mode: 'hunt',
    targetQueue: [],
    lastHit: null,
    hitChain: []
  })

  const getAdjacentCells = (row: number, col: number, shots: Board): [number, number][] => {
    const directions: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    return directions
      .map(([dr, dc]) => [row + dr, col + dc] as [number, number])
      .filter(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && shots[r][c] === 'empty')
  }

  const getSmartHuntTarget = (shots: Board): [number, number] => {
    // Use checkerboard pattern for more efficient hunting
    const candidates: [number, number][] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shots[r][c] === 'empty' && (r + c) % 2 === 0) {
          candidates.push([r, c])
        }
      }
    }
    // If no checkerboard cells available, use any empty cell
    if (candidates.length === 0) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (shots[r][c] === 'empty') {
            candidates.push([r, c])
          }
        }
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  const enemyShoot = useCallback(() => {
    const aiState = aiStateRef.current
    let row: number, col: number

    // Target mode: try to sink a ship we've hit
    if (aiState.mode === 'target' && aiState.targetQueue.length > 0) {
      // Filter out already shot positions
      aiState.targetQueue = aiState.targetQueue.filter(
        ([r, c]) => enemyShots[r][c] === 'empty'
      )

      if (aiState.targetQueue.length > 0) {
        [row, col] = aiState.targetQueue.shift()!
      } else {
        // No valid targets, switch back to hunt mode
        aiState.mode = 'hunt'
        aiState.hitChain = []
        ;[row, col] = getSmartHuntTarget(enemyShots)
      }
    } else {
      // Hunt mode: use checkerboard pattern
      aiState.mode = 'hunt'
      ;[row, col] = getSmartHuntTarget(enemyShots)
    }

    const newEnemyShots = enemyShots.map(r => [...r])
    const isHit = playerBoard[row][col] === 'ship'
    newEnemyShots[row][col] = isHit ? 'hit' : 'miss'
    setEnemyShots(newEnemyShots)

    if (isHit) {
      const newPlayerBoard = playerBoard.map(r => [...r])
      newPlayerBoard[row][col] = 'hit'
      setPlayerBoard(newPlayerBoard)
      setMessage('💥 Az ellenség eltalált!')

      // Switch to target mode and add adjacent cells
      aiState.mode = 'target'
      aiState.hitChain.push([row, col])

      // If we have multiple hits in a line, prioritize that direction
      if (aiState.hitChain.length >= 2) {
        const [prevRow, prevCol] = aiState.hitChain[aiState.hitChain.length - 2]
        const dr = row - prevRow
        const dc = col - prevCol

        // Add cells in the same direction first (higher priority)
        const nextInLine: [number, number] = [row + dr, col + dc]
        const prevInLine: [number, number] = [prevRow - dr, prevCol - dc]

        const priorityTargets = [nextInLine, prevInLine].filter(
          ([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && newEnemyShots[r][c] === 'empty'
        )
        aiState.targetQueue = [...priorityTargets, ...aiState.targetQueue]
      } else {
        // First hit - add all adjacent cells
        const adjacent = getAdjacentCells(row, col, newEnemyShots)
        aiState.targetQueue.push(...adjacent)
      }

      if (countRemainingShips(newPlayerBoard) === 0) {
        setGameOver('enemy')
        setMessage('😢 Vesztettél! Az ellenség elsüllyesztette a flottád.')
        return
      }
    } else {
      setMessage('💨 Az ellenség mellélőtt!')
      // If we miss in target mode, we might have finished a ship
      // Check if there are no more adjacent hits to chase
      if (aiState.mode === 'target' && aiState.targetQueue.length === 0) {
        aiState.mode = 'hunt'
        aiState.hitChain = []
      }
    }

    setTimeout(() => {
      setIsPlayerTurn(true)
      setMessage(`${playerName} köröd! Kattints az ellenség táblájára!`)
    }, 1000)
  }, [enemyShots, playerBoard, playerName])

  const handlePlayerShot = (row: number, col: number) => {
    if (!isPlayerTurn || gameOver) return
    if (playerShots[row][col] !== 'empty') return

    const newPlayerShots = playerShots.map(r => [...r])
    const isHit = enemyBoard[row][col] === 'ship'
    newPlayerShots[row][col] = isHit ? 'hit' : 'miss'
    setPlayerShots(newPlayerShots)

    if (isHit) {
      const newEnemyBoard = enemyBoard.map(r => [...r])
      newEnemyBoard[row][col] = 'hit'
      setEnemyBoard(newEnemyBoard)
      setMessage('🎯 Találat!')

      if (countRemainingShips(newEnemyBoard) === 0) {
        setGameOver('player')
        setMessage(`🎉 ${playerName} győztél! Elsüllyesztetted az ellenség flottáját!`)
        return
      }
    } else {
      setMessage('💨 Mellé!')
    }

    setIsPlayerTurn(false)
    setTimeout(enemyShoot, 1500)
  }

  const resetGame = () => {
    setEnemyBoard(createBoardWithShips())
    setPlayerBoard(createBoardWithShips())
    setPlayerShots(createEmptyBoard())
    setEnemyShots(createEmptyBoard())
    setIsPlayerTurn(true)
    setGameOver(null)
    setMessage('Kattints az ellenség táblájára!')
    aiStateRef.current = {
      mode: 'hunt',
      targetQueue: [],
      lastHit: null,
      hitChain: []
    }
  }

  const renderCell = (
    cellState: CellState,
    shotState: CellState,
    isEnemy: boolean,
    row: number,
    col: number
  ) => {
    const showShip = !isEnemy && cellState === 'ship'
    const isHit = shotState === 'hit'
    const isMiss = shotState === 'miss'

    return (
      <div
        key={`${row}-${col}`}
        className={`battleship-cell ${showShip ? 'ship' : ''} ${isHit ? 'hit' : ''} ${isMiss ? 'miss' : ''} ${isEnemy && !gameOver ? 'clickable' : ''}`}
        onClick={() => isEnemy && handlePlayerShot(row, col)}
      >
        {isHit && '💥'}
        {isMiss && '•'}
        {showShip && !isHit && '🚢'}
      </div>
    )
  }

  return (
    <div className="battleship">
      <div className={`game-status ${gameOver ? 'game-over' : ''}`}>
        {message}
      </div>

      <div className="boards-container">
        <div className="board-section">
          <h3>🎯 Ellenség</h3>
          <div className="battleship-board enemy">
            {enemyBoard.map((row, rowIndex) => (
              <div key={rowIndex} className="battleship-row">
                {row.map((cell, colIndex) =>
                  renderCell(cell, playerShots[rowIndex][colIndex], true, rowIndex, colIndex)
                )}
              </div>
            ))}
          </div>
          <p className="ships-remaining">
            Hajók: {countRemainingShips(enemyBoard)}
          </p>
        </div>

        <div className="board-section">
          <h3>🛡️ {playerName}</h3>
          <div className="battleship-board player">
            {playerBoard.map((row, rowIndex) => (
              <div key={rowIndex} className="battleship-row">
                {row.map((cell, colIndex) =>
                  renderCell(cell, enemyShots[rowIndex][colIndex], false, rowIndex, colIndex)
                )}
              </div>
            ))}
          </div>
          <p className="ships-remaining">
            Hajók: {countRemainingShips(playerBoard)}
          </p>
        </div>
      </div>

      {gameOver && (
        <button className="btn-primary" onClick={resetGame} style={{ marginTop: '1rem' }}>
          🔄 Új játék
        </button>
      )}
    </div>
  )
}
