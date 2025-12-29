import { useState, useEffect, useCallback, useRef } from 'react'
import { usePlayerName } from '../contexts/PlayerNameContext'
import type { Card, Rank } from './hungarianCards'
import {
  createDeck,
  shuffleDeck,
  SUIT_SYMBOLS,
  RANK_NAMES,
} from './hungarianCards'
import { getCardImagePath, getCardBackPath } from './cardImages'
import {
  database,
  ref,
  set,
  onValue,
  update,
  get,
  isFirebaseConfigured,
} from '../services/firebase'
import './Zsirozas.css'

type PlayerRole = 'host' | 'guest'

interface PileCard {
  card: Card
  playedBy: PlayerRole
}

interface PlayerInfo {
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

const initGame = (hostName: string): GameState => {
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
      name: hostName,
      connected: true,
      lastActive: Date.now(),
      aiTakeover: false,
    },
    guest: null,
  }
}

// Import the single-player Zsirozas for fallback
import ZsirozasSinglePlayer from './Zsirozas'

export default function ZsirozasMultiplayer({ roomId, isHost }: ZsirozasMultiplayerProps) {
  const { playerName } = usePlayerName()
  const [game, setGame] = useState<GameState | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [timeoutWarning, setTimeoutWarning] = useState(false)
  const [opponentAiTakeover, setOpponentAiTakeover] = useState(false)
  const [firebaseError, setFirebaseError] = useState(false)
  const myRole: PlayerRole = isHost ? 'host' : 'guest'
  const opponentRole: PlayerRole = isHost ? 'guest' : 'host'
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiPlayingRef = useRef(false)
  const dataReceivedRef = useRef(false)

  // Game path for Firebase - use rooms path since it has public access in Firebase rules
  const gamePath = `rooms/${roomId}/game`

  // Initialize or join game
  useEffect(() => {
    dataReceivedRef.current = false

    if (!database || !isFirebaseConfigured()) {
      setFirebaseError(true)
      return
    }

    const gameRef = ref(database, gamePath)

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val() as GameState | null

      if (!data) {
        // Game doesn't exist - host creates it
        if (isHost) {
          const newGame = initGame(playerName)
          set(gameRef, newGame).catch(() => setFirebaseError(true))
        }
        return
      }

      // Guest joining
      if (!isHost && data.status === 'waiting' && !data.guest) {
        update(gameRef, {
          status: 'playing',
          message: `${data.host.name} kezd!`,
          lastMoveTime: Date.now(),
          guest: {
            name: playerName,
            connected: true,
            lastActive: Date.now(),
            aiTakeover: false,
          },
        }).catch(() => setFirebaseError(true))
        return
      }

      dataReceivedRef.current = true
      setGame(data)

      // Check if it's my turn
      const myTurn = data.currentPlayer === myRole && data.status === 'playing'
      setIsMyTurn(myTurn)

      // Check opponent AI takeover
      const opponent = myRole === 'host' ? data.guest : data.host
      if (opponent?.aiTakeover) {
        setOpponentAiTakeover(true)
      }
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
  }, [gamePath, isHost, playerName, myRole])

  // Update my connection status periodically
  useEffect(() => {
    if (!database || !game) return

    const interval = setInterval(() => {
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
      newState.hostWon = [...newState.hostWon, ...pileCards]
    } else {
      newState.guestWon = [...newState.guestWon, ...pileCards]
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

    if (game.baseRank === null) {
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

  // Play card (for human player)
  const playCard = async (card: Card) => {
    if (!game || !database || !isMyTurn || game.status !== 'playing') return

    const gameRef = ref(database, gamePath)
    const currentHand = (myRole === 'host' ? game.hostHand : game.guestHand) || []
    const currentPile = game.pile || []
    const myName = myRole === 'host' ? game.host.name : game.guest?.name || playerName
    const cardName = `${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`

    let newState: GameState = {
      ...game,
      [myRole === 'host' ? 'hostHand' : 'guestHand']: currentHand.filter(c => c.id !== card.id),
      pile: [...currentPile, { card, playedBy: myRole }],
      lastMoveTime: Date.now(),
    }

    if (game.baseRank === null) {
      // Starting new round
      newState.baseRank = card.rank
      newState.lastHitter = myRole
      newState.roundStarter = myRole
      newState.currentPlayer = opponentRole
      newState.message = `${myName} hívott: ${cardName}`
    } else {
      // Responding
      if (canHit(card, game.baseRank)) {
        newState.lastHitter = myRole
        newState.currentPlayer = opponentRole
        newState.message = card.rank === '7'
          ? `🎯 ${myName} hetessel ütött!`
          : `🎯 ${myName} ütött: ${cardName}!`
      } else {
        newState.currentPlayer = opponentRole
        newState.message = `${myName}: ${cardName}`

        // Check if opponent (roundStarter) auto-takes
        if (game.roundStarter === opponentRole && game.lastHitter === opponentRole) {
          newState = takePile(newState)
        }
      }
    }

    await set(gameRef, newState)
  }

  // Pass (when I'm roundStarter and opponent hit)
  const playerPasses = async () => {
    if (!game || !database || !isMyTurn) return
    const currentPile = game.pile || []
    if (game.roundStarter !== myRole || game.lastHitter === myRole || currentPile.length === 0) return

    const gameRef = ref(database, gamePath)
    const newState = takePile({ ...game, lastMoveTime: Date.now() })
    await set(gameRef, newState)
  }

  // Auto-take when I'm roundStarter and lastHitter
  useEffect(() => {
    if (!game || !database || game.status !== 'playing') return
    if (game.currentPlayer !== myRole) return
    const currentPile = game.pile || []
    if (game.roundStarter !== myRole || currentPile.length === 0) return

    const gameRef = ref(database, gamePath)
    const currentHand = (myRole === 'host' ? game.hostHand : game.guestHand) || []

    if (game.lastHitter === myRole) {
      // Auto-take
      setTimeout(async () => {
        const newState = takePile({ ...game, lastMoveTime: Date.now() })
        await set(gameRef, newState)
      }, 500)
    } else if (!hasHittingCard(currentHand, game.baseRank)) {
      // Auto-pass (no hitting cards)
      setTimeout(async () => {
        const newState = takePile({ ...game, lastMoveTime: Date.now() })
        await set(gameRef, newState)
      }, 500)
    }
  }, [game, database, gamePath, myRole, takePile])

  // Reset game
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

  // Loading state
  if (!game) {
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

  const canPass = isMyTurn &&
    game.roundStarter === myRole &&
    game.lastHitter !== myRole &&
    pile.length > 0 &&
    hasHittingCard(myHand, game.baseRank)

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

      {game.status === 'finished' ? (
        <div className="game-over">
          <h2>{getWinner()}</h2>
          <p>👤 {myName}: {myPoints} pont | {opponentName}: {opponentPoints} pont</p>
          <button className="btn-primary" onClick={resetGame}>
            🔄 Új játék
          </button>
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
              {myHand.map(card =>
                renderCard(
                  card,
                  () => playCard(card),
                  !isMyTurn
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
