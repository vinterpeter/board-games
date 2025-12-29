import { database, ref, set, onValue, push, update, get, isFirebaseConfigured } from './firebase'
import type { Room, Player, TicTacToeState } from '../types'

// Create a new game room
export const createRoom = async (gameId: string, hostName: string): Promise<string> => {
  if (!isFirebaseConfigured() || !database) {
    // Return a mock room ID for local testing
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const roomsRef = ref(database, 'rooms')
  const newRoomRef = push(roomsRef)
  const roomId = newRoomRef.key!.slice(-6).toUpperCase()

  const playerId = Math.random().toString(36).substring(2, 10)

  const room: Room = {
    id: roomId,
    gameId,
    hostName,
    players: [
      {
        id: playerId,
        name: hostName,
        isHost: true,
        isReady: true,
      },
    ],
    status: 'waiting',
    gameState: null,
    createdAt: Date.now(),
  }

  await set(ref(database, `rooms/${roomId}`), room)

  // Store player ID in session
  sessionStorage.setItem('playerId', playerId)

  return roomId
}

// Join an existing room
export const joinRoom = async (roomId: string, playerName: string): Promise<boolean> => {
  if (!isFirebaseConfigured() || !database) {
    return true // Allow for local testing
  }

  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    return false
  }

  const room = snapshot.val() as Room
  if (room.players.length >= 2) {
    return false // Room is full
  }

  const playerId = Math.random().toString(36).substring(2, 10)
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    isHost: false,
    isReady: true,
  }

  await update(roomRef, {
    players: [...room.players, newPlayer],
    status: 'playing',
    gameState: initializeGameState(room.gameId),
  })

  sessionStorage.setItem('playerId', playerId)

  return true
}

// Subscribe to room updates
export const subscribeToRoom = (
  roomId: string,
  callback: (room: Room | null) => void
): (() => void) => {
  if (!isFirebaseConfigured() || !database) {
    // Return empty unsubscribe for local testing
    return () => {}
  }

  const roomRef = ref(database, `rooms/${roomId}`)
  const unsubscribe = onValue(roomRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Room) : null)
  })

  return unsubscribe
}

// Update game state
export const updateGameState = async (roomId: string, gameState: any): Promise<void> => {
  if (!isFirebaseConfigured() || !database) {
    return
  }

  await update(ref(database, `rooms/${roomId}`), { gameState })
}

// Initialize game state based on game type
const initializeGameState = (gameId: string): any => {
  switch (gameId) {
    case 'tictactoe':
      return {
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        isDraw: false,
      } as TicTacToeState
    default:
      return null
  }
}

// Leave/delete room
export const leaveRoom = async (roomId: string): Promise<void> => {
  if (!isFirebaseConfigured() || !database) {
    return
  }

  const playerId = sessionStorage.getItem('playerId')
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) return

  const room = snapshot.val() as Room
  const player = room.players.find((p) => p.id === playerId)

  if (player?.isHost) {
    // Host leaves - delete room
    await set(roomRef, null)
  } else {
    // Guest leaves - remove from players
    const updatedPlayers = room.players.filter((p) => p.id !== playerId)
    await update(roomRef, {
      players: updatedPlayers,
      status: 'waiting',
    })
  }
}
