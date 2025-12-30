import { useState, useEffect, useCallback, useRef } from 'react'
import { usePlayerName } from '../../contexts/PlayerNameContext'
import type { Card, Rank } from '../shared/hungarianCards'
import {
  createDeck,
  shuffleDeck,
  SUIT_SYMBOLS,
  RANK_NAMES,
} from '../shared/hungarianCards'
import { getCardImagePath, getCardBackPath } from '../shared/cardImages'
import {
  database,
  ref,
  set,
  onValue,
  update,
  isFirebaseConfigured,
} from '../../services/firebase'
import './style.css'

type PlayerRole = 'host' | 'guest'

interface PileCard {
  card: Card
  playedBy: PlayerRole
}

interface PlayerInfo {
  id: string  // Unique ID per player connection
  name: string
  connected: boolean
  lastActive: number
  aiTakeover: boolean
}

interface GameState {
  status: 'waiting' | 'playing' | 'finished'
  deck: Card[]
  hostHand: Card[]
  guestHand: Card[]
  pile: PileCard[]
  hostWon: Card[]
  guestWon: Card[]
  currentPlayer: PlayerRole
  baseRank: Rank | null
  lastHitter: PlayerRole | null
  roundStarter: PlayerRole | null
  lastMoveTime: number
  message: string
  host: PlayerInfo
  guest: PlayerInfo | null
  // Rematch system
  rematchRequestedBy: PlayerRole | null
  rematchDeclinedBy: PlayerRole | null
}

interface ZsirozasMultiplayerProps {
  roomId: string
  isHost: boolean
}

const HAND_SIZE = 4
const TURN_TIMEOUT = 60000 // 1 minute

// Only 10 and Ász count as "zsír"
const isZsir = (card: Card): boolean => {
  return card.rank === '10' || card.rank === 'asz'
}

// Count zsír points
const countZsirPoints = (cards: Card[]): number => {
  return cards.filter(isZsir).length * 10
}

// Check if card can hit (same rank OR seven)
const canHit = (card: Card, baseRank: Rank | null): boolean => {
  if (!baseRank) return false
  return card.rank === baseRank || card.rank === '7'
}

// Check if hand has any hitting card
const hasHittingCard = (hand: Card[], baseRank: Rank | null): boolean => {
  if (!baseRank) return false
  return hand.some(c => canHit(c, baseRank))
}

// Draw cards for both players
const drawCards = (state: GameState): GameState => {
  const newState = { ...state }
  const deck = [...newState.deck]

  const hostNeeds = HAND_SIZE - newState.hostHand.length
  const guestNeeds = HAND_SIZE - newState.guestHand.length
  const totalNeeds = hostNeeds + guestNeeds

  if (deck.length >= totalNeeds) {
    while (deck.length > 0 && newState.hostHand.length < HAND_SIZE) {
      newState.hostHand = [...newState.hostHand, deck.shift()!]
    }
    while (deck.length > 0 && newState.guestHand.length < HAND_SIZE) {
      newState.guestHand = [...newState.guestHand, deck.shift()!]
    }
  } else {
    const eachGets = Math.floor(deck.length / 2)
    const remainder = deck.length % 2
    for (let i = 0; i < eachGets + remainder && deck.length > 0; i++) {
      newState.hostHand = [...newState.hostHand, deck.shift()!]
    }
    for (let i = 0; i < eachGets && deck.length > 0; i++) {
      newState.guestHand = [...newState.guestHand, deck.shift()!]
    }
  }

  newState.deck = deck
  return newState
}

const initGame = (hostName: string, hostId: string): GameState => {
  const deck = shuffleDeck(createDeck())
  const hostHand = deck.slice(0, HAND_SIZE)
  const guestHand = deck.slice(HAND_SIZE, HAND_SIZE * 2)
  const remainingDeck = deck.slice(HAND_SIZE * 2)

  return {
    status: 'waiting',
    deck: remainingDeck,
    hostHand,
    guestHand,
    pile: [],
    hostWon: [],
    guestWon: [],
    currentPlayer: 'host',
    baseRank: null,
    lastHitter: null,
    roundStarter: null,
    lastMoveTime: Date.now(),
    message: 'Várakozás a másik játékosra...',
    host: {
      id: hostId,
      name: hostName,
      connected: true,
      lastActive: Date.now(),
      aiTakeover: false,
    },
    guest: null,
    rematchRequestedBy: null,
    rematchDeclinedBy: null,
  }
}

// Import the single-player Zsirozas for fallback
import ZsirozasSinglePlayer from '.'

export default function ZsirozasMultiplayer({ roomId, isHost }: ZsirozasMultiplayerProps) {
  const { playerName } = usePlayerName()
  const [game, setGame] = useState<GameState | null>(null)
  const [myRole, setMyRole] = useState<PlayerRole | null>(null)
  // Removed isMyTurn state - computed directly from game state instead
  const [timeoutWarning, setTimeoutWarning] = useState(false)
  const [opponentAiTakeover, setOpponentAiTakeover] = useState(false)
  const [firebaseError, setFirebaseError] = useState(false)
  const [duplicatePlayer] = useState(false)
  const [roomFull, setRoomFull] = useState(false)
  const opponentRole: PlayerRole = myRole === 'host' ? 'guest' : 'host'
  const aiPlayingRef = useRef(false)
  const dataReceivedRef = useRef(false)
  const roleAssignedRef = useRef(false)
  // Unique ID per component instance to handle shared sessionStorage in same browser
  const playerIdRef = useRef(Math.random().toString(36).substring(2, 10))

  // Game path for Firebase - use rooms path since it has public access in Firebase rules
  const gamePath = `rooms/${roomId}/game`

  // Initialize or join game
  useEffect(() => {
    dataReceivedRef.current = false
    roleAssignedRef.current = false

    if (!database || !isFirebaseConfigured()) {
      setFirebaseError(true)
      return
    }

    const gameRef = ref(database, gamePath)

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val() as GameState | null

      if (!data) {
        // Game doesn't exist - create it (I'm the host)
        if (!roleAssignedRef.current) {
          roleAssignedRef.current = true
          setMyRole('host')
          const newGame = initGame(playerName, playerIdRef.current)
          set(gameRef, newGame).catch(() => setFirebaseError(true))
        }
        return
      }

      // Determine my role based on game state
      if (!roleAssignedRef.current) {
        if (data.status === 'waiting' && !data.guest) {
          // Game exists but no guest yet
          // Check if this is the same player (host) reconnecting
          if (data.host.name === playerName) {
            roleAssignedRef.current = true
            setMyRole('host')
            // Update host ID to current session
            update(gameRef, {
              'host.id': playerIdRef.current,
              'host.lastActive': Date.now(),
              'host.connected': true,
            }).catch(() => {})
            return
          }
          // New guest joining
          roleAssignedRef.current = true
          setMyRole('guest')
          update(gameRef, {
            status: 'playing',
            message: `${data.host.name} kezd!`,
            lastMoveTime: Date.now(),
            guest: {
              id: playerIdRef.current,
              name: playerName,
              connected: true,
              lastActive: Date.now(),
              aiTakeover: false,
            },
          }).catch(() => setFirebaseError(true))
          return
        } else {
          // Game already has both players - figure out who I am
          roleAssignedRef.current = true
          if (data.host.id === playerIdRef.current) {
            setMyRole('host')
          } else if (data.guest?.id === playerIdRef.current) {
            setMyRole('guest')
          } else if (data.host.name === playerName) {
            // Reconnecting as host - update session ID
            setMyRole('host')
            update(gameRef, {
              'host.id': playerIdRef.current,
              'host.lastActive': Date.now(),
              'host.connected': true,
            }).catch(() => {})
          } else if (data.guest?.name === playerName) {
            // Reconnecting as guest - update session ID
            setMyRole('guest')
            update(gameRef, {
              'guest.id': playerIdRef.current,
              'guest.lastActive': Date.now(),
              'guest.connected': true,
            }).catch(() => {})
          } else {
            // I'm neither host nor guest - room is full
            if (data.guest != null) {
              setRoomFull(true)
              return
            }
            // Fallback - use the isHost prop
            setMyRole(isHost ? 'host' : 'guest')
          }
        }
      }

      dataReceivedRef.current = true
      setGame(data)
    }, (error) => {
      console.error('Firebase error:', error)
      setFirebaseError(true)
    })

    // Timeout for loading - if no data in 5 seconds, fallback to AI
    const loadTimeout = setTimeout(() => {
      if (!dataReceivedRef.current) {
        setFirebaseError(true)
      }
    }, 5000)

    return () => {
      unsubscribe()
      clearTimeout(loadTimeout)
    }
  }, [gamePath, isHost, playerName])

  // Compute isMyTurn directly from game state (not in state to avoid lag)
  const isMyTurn = game !== null && myRole !== null &&
    game.currentPlayer === myRole && game.status === 'playing'

  // Check opponent AI takeover
  useEffect(() => {
    if (!game || !myRole) return
    const opponent = myRole === 'host' ? game.guest : game.host
    if (opponent?.aiTakeover) {
      setOpponentAiTakeover(true)
    }
  }, [game, myRole])

  // Update my connection status periodically
  useEffect(() => {
    if (!database || !game || !myRole) return

    const interval = setInterval(() => {
      if (!database) return
      const updatePath = myRole === 'host' ? 'host' : 'guest'
      update(ref(database, `${gamePath}/${updatePath}`), {
        lastActive: Date.now(),
        connected: true,
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [database, game, myRole, gamePath])

  // Take pile function
  const takePile = useCallback((state: GameState): GameState => {
    if (!state.lastHitter || state.pile.length === 0) return state

    const winner = state.lastHitter
    const pileCards = state.pile.map(p => p.card)
    const winnerName = winner === 'host' ? state.host.name : state.guest?.name || 'Vendég'

    let newState: GameState = {
      ...state,
      pile: [],
      baseRank: null,
      lastHitter: null,
      roundStarter: null,
      currentPlayer: winner,
      lastMoveTime: Date.now(),
      message: `${winnerName} bevitte a paklit!`,
    }

    if (winner === 'host') {
      newState.hostWon = [...(newState.hostWon || []), ...pileCards]
    } else {
      newState.guestWon = [...(newState.guestWon || []), ...pileCards]
    }

    newState = drawCards(newState)

    if (newState.hostHand.length === 0 && newState.guestHand.length === 0) {
      newState.status = 'finished'
    }

    return newState
  }, [])

  // AI play for timed-out player
  const triggerAIPlay = useCallback(async () => {
    if (!game || !database || aiPlayingRef.current) return
    aiPlayingRef.current = true

    const gameRef = ref(database, gamePath)
    const currentPlayerRole = game.currentPlayer
    const hand = currentPlayerRole === 'host' ? [...game.hostHand] : [...game.guestHand]

    if (hand.length === 0) {
      aiPlayingRef.current = false
      return
    }

    // Simple AI logic - same as single player
    let cardToPlay: Card
    let newState: GameState

    if (game.baseRank == null) {
      // Start new round - play lowest value card
      hand.sort((a, b) => {
        const aScore = isZsir(a) ? 100 : (a.rank === '7' ? 50 : 0)
        const bScore = isZsir(b) ? 100 : (b.rank === '7' ? 50 : 0)
        return aScore - bScore
      })
      cardToPlay = hand[0]

      const newHand = hand.filter(c => c.id !== cardToPlay.id)
      newState = {
        ...game,
        [currentPlayerRole === 'host' ? 'hostHand' : 'guestHand']: newHand,
        pile: [{ card: cardToPlay, playedBy: currentPlayerRole }],
        baseRank: cardToPlay.rank,
        lastHitter: currentPlayerRole,
        roundStarter: currentPlayerRole,
        currentPlayer: currentPlayerRole === 'host' ? 'guest' : 'host',
        lastMoveTime: Date.now(),
        message: `🤖 AI (${currentPlayerRole === 'host' ? game.host.name : game.guest?.name}) hívott`,
      }
    } else {
      // Responding to existing round
      const hittingCards = hand.filter(c => canHit(c, game.baseRank))
      const nonHittingCards = hand.filter(c => !canHit(c, game.baseRank))
      const gamePile = game.pile || []
      const pileHasZsir = gamePile.some(p => isZsir(p.card))

      if (hittingCards.length > 0 && pileHasZsir) {
        cardToPlay = hittingCards[0]
        const newHand = hand.filter(c => c.id !== cardToPlay.id)
        newState = {
          ...game,
          [currentPlayerRole === 'host' ? 'hostHand' : 'guestHand']: newHand,
          pile: [...gamePile, { card: cardToPlay, playedBy: currentPlayerRole }],
          lastHitter: currentPlayerRole,
          currentPlayer: currentPlayerRole === 'host' ? 'guest' : 'host',
          lastMoveTime: Date.now(),
          message: `🤖 AI ütött!`,
        }
      } else if (nonHittingCards.length > 0) {
        cardToPlay = nonHittingCards[0]
        const newHand = hand.filter(c => c.id !== cardToPlay.id)
        newState = {
          ...game,
          [currentPlayerRole === 'host' ? 'hostHand' : 'guestHand']: newHand,
          pile: [...gamePile, { card: cardToPlay, playedBy: currentPlayerRole }],
          currentPlayer: currentPlayerRole === 'host' ? 'guest' : 'host',
          lastMoveTime: Date.now(),
          message: `🤖 AI játszott`,
        }

        // Check if roundStarter should auto-take
        if (game.roundStarter !== currentPlayerRole && game.lastHitter === game.roundStarter) {
          newState = takePile(newState)
        }
      } else {
        cardToPlay = hittingCards[0]
        const newHand = hand.filter(c => c.id !== cardToPlay.id)
        newState = {
          ...game,
          [currentPlayerRole === 'host' ? 'hostHand' : 'guestHand']: newHand,
          pile: [...gamePile, { card: cardToPlay, playedBy: currentPlayerRole }],
          lastHitter: currentPlayerRole,
          currentPlayer: currentPlayerRole === 'host' ? 'guest' : 'host',
          lastMoveTime: Date.now(),
          message: `🤖 AI ütött`,
        }
      }
    }

    await set(gameRef, newState)
    aiPlayingRef.current = false
  }, [game, database, gamePath, takePile])

  // Timeout handling - check if opponent timed out
  useEffect(() => {
    if (!game || game.status !== 'playing' || !database) return
    if (game.currentPlayer === myRole) return // It's my turn, don't check opponent

    const checkTimeout = () => {
      if (!database) return
      const timeSinceLastMove = Date.now() - game.lastMoveTime

      // Show warning at 45 seconds
      if (timeSinceLastMove > 45000 && timeSinceLastMove < TURN_TIMEOUT) {
        setTimeoutWarning(true)
      }

      // AI takeover at 60 seconds
      if (timeSinceLastMove >= TURN_TIMEOUT) {
        setTimeoutWarning(false)
        const opponentPath = opponentRole === 'host' ? 'host' : 'guest'
        update(ref(database, `${gamePath}/${opponentPath}`), {
          aiTakeover: true,
        })
        // Trigger AI play for opponent
        triggerAIPlay()
      }
    }

    const interval = setInterval(checkTimeout, 1000)
    return () => clearInterval(interval)
  }, [game, database, gamePath, myRole, opponentRole, triggerAIPlay])

  // Immediate AI play when opponent is AI and it's their turn
  useEffect(() => {
    if (!game || game.status !== 'playing' || !database || !myRole) return
    if (game.currentPlayer === myRole) return // It's my turn

    const opponent = myRole === 'host' ? game.guest : game.host
    if (!opponent?.aiTakeover) return // Opponent is not AI

    // AI opponent needs to play - trigger with small delay for UX
    const timeout = setTimeout(() => {
      triggerAIPlay()
    }, 800)

    return () => clearTimeout(timeout)
  }, [game, database, myRole, triggerAIPlay])

  // Play card (for human player)
  const playCard = async (card: Card) => {
    if (!game || !database || !isMyTurn || !myRole || game.status !== 'playing') return

    const gameRef = ref(database, gamePath)
    const currentHand = (myRole === 'host' ? game.hostHand : game.guestHand) || []
    const currentPile = game.pile || []
    const myName = myRole === 'host' ? game.host.name : game.guest?.name || playerName
    const opponentName = myRole === 'host' ? game.guest?.name || 'Vendég' : game.host.name
    const cardName = `${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`

    let newState: GameState = {
      ...game,
      [myRole === 'host' ? 'hostHand' : 'guestHand']: currentHand.filter(c => c.id !== card.id),
      pile: [...currentPile, { card, playedBy: myRole }],
      lastMoveTime: Date.now(),
    }

    if (game.baseRank == null) {
      // Starting new round
      newState.baseRank = card.rank
      newState.lastHitter = myRole
      newState.roundStarter = myRole
      newState.currentPlayer = opponentRole
      newState.message = `${myName} hívott: ${cardName}`
    } else if (canHit(card, game.baseRank)) {
      // Responding with a hitting card - I become lastHitter
      newState.lastHitter = myRole
      newState.currentPlayer = opponentRole
      newState.message = card.rank === '7'
        ? `🎯 ${myName} hetessel ütött!`
        : `🎯 ${myName} ütött: ${cardName}!`
    } else {
      // Responding with a non-hitting card - lastHitter takes the pile
      newState.message = `${myName} nem ütött - ${opponentName} viszi!`
      // The lastHitter (roundStarter or whoever hit last) takes the pile
      newState = takePile(newState)
    }

    await set(gameRef, newState)
  }

  // Pass - only when I'm roundStarter and opponent hit but I choose not to hit back
  const playerPasses = async () => {
    if (!game || !database || !isMyTurn || !myRole) return
    const currentPile = game.pile || []
    if (currentPile.length === 0 || game.baseRank == null) return
    if (game.roundStarter !== myRole || game.lastHitter === myRole) return

    const myName = myRole === 'host' ? game.host.name : game.guest?.name || playerName
    const opponentName = myRole === 'host' ? game.guest?.name || 'Vendég' : game.host.name

    const gameRef = ref(database, gamePath)
    const newState = takePile({ ...game, lastMoveTime: Date.now() })
    newState.message = `${myName} passzolt - ${opponentName} viszi a paklit!`
    await set(gameRef, newState)
  }

  // Track which game state we've processed auto-action for
  const lastAutoActionStateRef = useRef<string | null>(null)
  const autoActionInProgressRef = useRef(false)

  // Auto-take/auto-pass logic - only runs when it's MY turn and I can't make a move
  useEffect(() => {
    if (!game || !database || !myRole || game.status !== 'playing') return
    if (game.currentPlayer !== myRole) {
      // Not my turn - reset the tracking
      lastAutoActionStateRef.current = null
      autoActionInProgressRef.current = false
      return
    }

    // If auto-action is already in progress, don't start another
    if (autoActionInProgressRef.current) return

    const currentPile = game.pile || []
    if (currentPile.length === 0 || game.baseRank == null) {
      // Starting new round - reset the tracking
      lastAutoActionStateRef.current = null
      return
    }

    // Create a unique key for this game state to prevent re-triggering
    // Only include the fields that matter for auto-action decision
    const stateKey = `${game.currentPlayer}-${game.roundStarter}-${game.lastHitter}-${game.baseRank}-${currentPile.length}`

    // If we've already initiated auto-action for this state, don't do it again
    if (lastAutoActionStateRef.current === stateKey) return

    const gameRef = ref(database, gamePath)
    const currentHand = (myRole === 'host' ? game.hostHand : game.guestHand) || []
    const myName = myRole === 'host' ? game.host.name : game.guest?.name || playerName
    const opponentName = myRole === 'host' ? game.guest?.name || 'Vendég' : game.host.name

    let shouldAutoAction = false
    let actionMessage = ''

    if (game.roundStarter === myRole) {
      // I started this round
      if (game.lastHitter === myRole) {
        // Auto-take - I'm the last hitter (opponent couldn't/didn't hit)
        shouldAutoAction = true
        actionMessage = `${myName} bevitte a paklit!`
      } else if (!hasHittingCard(currentHand, game.baseRank)) {
        // Auto-pass - opponent hit and I can't hit back
        shouldAutoAction = true
        actionMessage = `${myName} nem tud visszaütni - ${opponentName} viszi!`
      }
    } else {
      // I'm responding (not round starter)
      if (!hasHittingCard(currentHand, game.baseRank)) {
        // Auto-pass - I can't hit, roundStarter takes pile
        shouldAutoAction = true
        actionMessage = `${myName} nem tud ütni - ${opponentName} viszi!`
      }
    }

    if (!shouldAutoAction) return

    // Mark this state as being processed
    lastAutoActionStateRef.current = stateKey
    autoActionInProgressRef.current = true

    // Longer delay for human players to see what happened
    const timeoutId = setTimeout(async () => {
      try {
        // Re-check game state before executing (prevent race conditions)
        // The game state might have changed while we were waiting
        const newState = takePile({ ...game, lastMoveTime: Date.now() })
        newState.message = actionMessage
        await set(gameRef, newState)
      } catch (error) {
        console.error('Auto-action failed:', error)
        // Reset so we can retry
        lastAutoActionStateRef.current = null
      } finally {
        autoActionInProgressRef.current = false
      }
    }, 1500) // Increased to 1.5 seconds for better UX

    return () => {
      clearTimeout(timeoutId)
      autoActionInProgressRef.current = false
    }
  }, [game, database, gamePath, myRole, takePile, playerName])

  // Start game with AI opponent (when waiting alone)
  const startWithAI = async () => {
    if (!database || !game || game.status !== 'waiting') return

    const gameRef = ref(database, gamePath)
    await update(gameRef, {
      status: 'playing',
      message: `${game.host.name} kezd!`,
      lastMoveTime: Date.now(),
      guest: {
        id: 'ai-opponent',
        name: '🤖 AI Ellenfél',
        connected: true,
        lastActive: Date.now(),
        aiTakeover: true, // AI from the start
      },
    })
  }

  // Reset game (start new round)
  const resetGame = async () => {
    if (!database || !game) return

    const gameRef = ref(database, gamePath)
    const deck = shuffleDeck(createDeck())
    const hostHand = deck.slice(0, HAND_SIZE)
    const guestHand = deck.slice(HAND_SIZE, HAND_SIZE * 2)
    const remainingDeck = deck.slice(HAND_SIZE * 2)

    const newGame: GameState = {
      status: 'playing',
      deck: remainingDeck,
      hostHand,
      guestHand,
      pile: [],
      hostWon: [],
      guestWon: [],
      currentPlayer: 'host',
      baseRank: null,
      lastHitter: null,
      roundStarter: null,
      lastMoveTime: Date.now(),
      message: `${game.host.name} kezd!`,
      host: { ...game.host, aiTakeover: false },
      guest: game.guest ? { ...game.guest, aiTakeover: false } : null,
      rematchRequestedBy: null,
      rematchDeclinedBy: null,
    }

    await set(gameRef, newGame)
  }

  // Request rematch from opponent
  const requestRematch = async () => {
    if (!database || !game || !myRole) return
    const gameRef = ref(database, gamePath)
    await update(gameRef, {
      rematchRequestedBy: myRole,
    })
  }

  // Accept rematch - start new game
  const acceptRematch = async () => {
    await resetGame()
  }

  // Decline rematch
  const declineRematch = async () => {
    if (!database || !game || !myRole) return
    const gameRef = ref(database, gamePath)
    await update(gameRef, {
      rematchDeclinedBy: myRole,
    })
  }

  // Start with AI after opponent declined rematch
  const startWithAIAfterDecline = async () => {
    if (!database || !game) return

    const gameRef = ref(database, gamePath)
    const deck = shuffleDeck(createDeck())
    const hostHand = deck.slice(0, HAND_SIZE)
    const guestHand = deck.slice(HAND_SIZE, HAND_SIZE * 2)
    const remainingDeck = deck.slice(HAND_SIZE * 2)

    // Replace opponent with AI
    const newGame: GameState = {
      status: 'playing',
      deck: remainingDeck,
      hostHand,
      guestHand,
      pile: [],
      hostWon: [],
      guestWon: [],
      currentPlayer: 'host',
      baseRank: null,
      lastHitter: null,
      roundStarter: null,
      lastMoveTime: Date.now(),
      message: `${game.host.name} kezd!`,
      host: game.host,
      guest: {
        id: 'ai-opponent',
        name: '🤖 AI Ellenfél',
        connected: true,
        lastActive: Date.now(),
        aiTakeover: true,
      },
      rematchRequestedBy: null,
      rematchDeclinedBy: null,
    }

    await set(gameRef, newGame)
  }

  // Render card
  const renderCard = (card: Card, onClick?: () => void, disabled?: boolean) => (
    <div
      key={card.id}
      className={`hungarian-card ${onClick && !disabled ? 'playable' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => onClick && !disabled && onClick()}
    >
      <img
        src={getCardImagePath(card.suit, card.rank)}
        alt={`${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`}
        draggable={false}
      />
    </div>
  )

  // Firebase error fallback - play against AI
  if (firebaseError) {
    return <ZsirozasSinglePlayer />
  }

  // Duplicate player error
  if (duplicatePlayer) {
    return (
      <div className="zsirozas">
        <div className="game-over">
          <h2>⚠️ Már bent vagy!</h2>
          <p>Ezzel a névvel már csatlakoztál ehhez a szobához.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Használj másik nevet vagy nyisd meg a másik ablakot.
          </p>
        </div>
      </div>
    )
  }

  // Room full error - third player trying to join
  if (roomFull) {
    return (
      <div className="zsirozas">
        <div className="game-over">
          <h2>🚫 Tele a szoba!</h2>
          <p>Ez a játék már elkezdődött két játékossal.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Hozz létre új szobát vagy csatlakozz másik játékhoz.
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (!game || !myRole) {
    return (
      <div className="zsirozas">
        <div className="game-header">
          <span>Betöltés...</span>
        </div>
      </div>
    )
  }

  // Waiting for opponent
  if (game.status === 'waiting') {
    return (
      <div className="zsirozas">
        <div className="game-header">
          <span>Várakozás a másik játékosra...</span>
        </div>
        <p style={{ color: '#888', textAlign: 'center' }}>
          Oszd meg a szoba kódot a barátaiddal!
        </p>
        <p style={{ color: '#666', textAlign: 'center', marginTop: '1rem' }}>
          vagy
        </p>
        <button
          className="btn-primary"
          onClick={startWithAI}
          style={{ marginTop: '0.5rem' }}
        >
          🤖 AI ellenfél ellen
        </button>
      </div>
    )
  }

  const myHand = (myRole === 'host' ? game.hostHand : game.guestHand) || []
  const opponentHand = (myRole === 'host' ? game.guestHand : game.hostHand) || []
  const myWon = (myRole === 'host' ? game.hostWon : game.guestWon) || []
  const opponentWon = (myRole === 'host' ? game.guestWon : game.hostWon) || []
  const pile = game.pile || []
  const myName = myRole === 'host' ? game.host.name : game.guest?.name || playerName
  const opponentName = myRole === 'host' ? game.guest?.name || 'Vendég' : game.host.name

  const myPoints = countZsirPoints(myWon)
  const opponentPoints = countZsirPoints(opponentWon)

  const getWinner = () => {
    if (myPoints > opponentPoints) return `🎉 ${myName} nyertél!`
    if (opponentPoints > myPoints) return `${opponentName} nyert!`
    return '🤝 Döntetlen!'
  }

  // Can pass when: I'm the round starter, opponent hit, and I CAN hit back but choose not to
  // (When can't hit, auto-pass happens automatically)
  // Note: Firebase may return undefined instead of null for baseRank
  const canPass = isMyTurn && pile.length > 0 && game.baseRank != null &&
    game.roundStarter === myRole && game.lastHitter !== myRole && hasHittingCard(myHand, game.baseRank)

  return (
    <div className="zsirozas">
      {/* Timeout warning */}
      {timeoutWarning && (
        <div className="timeout-warning">
          ⏰ {opponentName} hamarosan időtúllépés - AI veszi át!
        </div>
      )}

      {/* AI takeover notification */}
      {opponentAiTakeover && (
        <div className="ai-takeover-notice">
          🤖 {opponentName} helyett AI játszik (időtúllépés)
        </div>
      )}

      <div className="game-header">
        <span className={`score-left ${game.currentPlayer === myRole ? 'active' : ''}`}>
          👤 {myPoints}
        </span>
        <span className={`score-right ${game.currentPlayer === opponentRole ? 'active' : ''}`}>
          {opponentAiTakeover ? '🤖' : '👤'} {opponentPoints}
        </span>
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
        {isMyTurn ? '🎯 Te jössz!' : `⏳ ${opponentName} gondolkodik...`}
      </div>

      {/* Game message */}
      {game.message && (
        <div className="game-message">
          {game.message}
        </div>
      )}

      {game.status === 'finished' ? (
        <div className="game-over">
          <h2>{getWinner()}</h2>
          <p>👤 {myName}: {myPoints} pont | {opponentName}: {opponentPoints} pont</p>

          {/* Rematch UI - different for AI vs human opponent */}
          {game.guest?.aiTakeover ? (
            // AI opponent - just start new game directly
            <button className="btn-primary" onClick={resetGame}>
              🔄 Új játék
            </button>
          ) : game.rematchDeclinedBy === opponentRole ? (
            // Opponent declined - offer AI option
            <div className="rematch-section">
              <p style={{ color: '#ff6b6b', marginBottom: '0.5rem' }}>
                {opponentName} nem akar új játékot.
              </p>
              <button className="btn-primary" onClick={startWithAIAfterDecline}>
                🤖 Folytatás AI-val
              </button>
            </div>
          ) : game.rematchDeclinedBy === myRole ? (
            // I declined - waiting or leave
            <p style={{ color: '#888' }}>Elutasítottad az új játékot.</p>
          ) : game.rematchRequestedBy === myRole ? (
            // I requested - waiting for opponent
            <div className="rematch-section">
              <p style={{ color: '#ffd93d' }}>
                ⏳ Várakozás {opponentName} válaszára...
              </p>
            </div>
          ) : game.rematchRequestedBy === opponentRole ? (
            // Opponent requested - show accept/decline buttons
            <div className="rematch-section">
              <p style={{ marginBottom: '0.5rem' }}>
                {opponentName} új játékot szeretne!
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={acceptRematch}>
                  ✅ Elfogad
                </button>
                <button
                  className="btn-secondary"
                  onClick={declineRematch}
                  style={{ background: '#666' }}
                >
                  ❌ Elutasít
                </button>
              </div>
            </div>
          ) : (
            // No request yet - show request button
            <button className="btn-primary" onClick={requestRematch}>
              🔄 Új játék kérése
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Opponent hand */}
          <div className="ai-hand">
            <div className="hand-label">
              {opponentAiTakeover ? '🤖' : '👤'} {opponentName}
            </div>
            <div className="cards">
              {opponentHand.map((_, i) => (
                <div key={i} className="hungarian-card back">
                  <img src={getCardBackPath()} alt="Kártya hátlap" draggable={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Pile */}
          <div className="pile-area">
            <div className="pile-row">
              <div className="pile">
                {pile.length === 0 ? (
                  <div className="empty-pile"></div>
                ) : (
                  pile.map((pileCard, i) => (
                    <div key={pileCard.card.id} className="pile-card-wrapper" style={{ marginLeft: i > 0 ? -50 : 0 }}>
                      {renderCard(pileCard.card)}
                    </div>
                  ))
                )}
              </div>
              {canPass && (
                <button className="btn-pass" onClick={playerPasses}>
                  ✋ Passz
                </button>
              )}
            </div>
          </div>

          {/* My hand */}
          <div className="player-hand">
            <div className="hand-label">👤 {myName}</div>
            <div className="cards">
              {myHand.map(card => {
                // Card is disabled only if it's not my turn
                // When responding, player can play ANY card (hitting or not)
                const isDisabled = !isMyTurn
                return renderCard(
                  card,
                  () => playCard(card),
                  isDisabled
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
