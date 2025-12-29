import { useState, useEffect, useCallback } from 'react'
import type { Card, Suit } from './hungarianCards'
import {
  createDeck,
  shuffleDeck,
  SUIT_SYMBOLS,
  RANK_NAMES,
  SNAPSZER_RANKS,
  SNAPSZER_VALUES,
  SNAPSZER_STRENGTH
} from './hungarianCards'
import { getCardImagePath, getCardBackPath } from './cardImages'
import './Snapszer.css'

type Player = 'player' | 'ai'

interface GameState {
  deck: Card[]
  playerHand: Card[]
  aiHand: Card[]
  playerTricks: Card[]
  aiTricks: Card[]
  trump: Suit
  trumpCard: Card | null
  currentTrick: { player: Card | null; ai: Card | null }
  currentPlayer: Player
  trickStarter: Player
  playerPoints: number
  aiPoints: number
  deckClosed: boolean
  closedBy: Player | null
  gamePhase: 'playing' | 'finished'
  roundWinner: Player | null
  lastAction: string
  playerMarriages: Suit[]
  aiMarriages: Suit[]
}

const WINNING_SCORE = 66

const initGame = (): GameState => {
  const deck = shuffleDeck(createDeck(SNAPSZER_RANKS))
  const playerHand = deck.slice(0, 5)
  const aiHand = deck.slice(5, 10)
  const trumpCard = deck[10]
  const remainingDeck = deck.slice(11)

  return {
    deck: remainingDeck,
    playerHand,
    aiHand,
    playerTricks: [],
    aiTricks: [],
    trump: trumpCard.suit,
    trumpCard,
    currentTrick: { player: null, ai: null },
    currentPlayer: 'player',
    trickStarter: 'player',
    playerPoints: 0,
    aiPoints: 0,
    deckClosed: false,
    closedBy: null,
    gamePhase: 'playing',
    roundWinner: null,
    lastAction: 'Te kezdesz! Tegyél le egy lapot.',
    playerMarriages: [],
    aiMarriages: []
  }
}

const getCardStrength = (card: Card, trump: Suit, leadSuit: Suit | null): number => {
  let strength = SNAPSZER_STRENGTH[card.rank]
  if (card.suit === trump) {
    strength += 100 // Trump beats all
  } else if (leadSuit && card.suit !== leadSuit) {
    strength = -1 // Can't win if not following suit and not trump
  }
  return strength
}

const canPlayCard = (
  card: Card,
  hand: Card[],
  leadCard: Card | null,
  trump: Suit,
  deckClosed: boolean
): boolean => {
  if (!leadCard) return true // First to play
  if (!deckClosed) return true // Open deck: can play anything

  // Closed deck rules: must follow suit, must beat
  const leadSuit = leadCard.suit
  const hasSuit = hand.some(c => c.suit === leadSuit)
  const hasTrump = hand.some(c => c.suit === trump)

  if (hasSuit) {
    // Must follow suit
    if (card.suit !== leadSuit) return false
    // Must beat if possible
    const leadStrength = getCardStrength(leadCard, trump, leadSuit)
    const canBeat = hand.some(c =>
      c.suit === leadSuit && getCardStrength(c, trump, leadSuit) > leadStrength
    )
    if (canBeat && getCardStrength(card, trump, leadSuit) <= leadStrength) return false
  } else if (hasTrump && leadCard.suit !== trump) {
    // Must play trump if no suit
    if (card.suit !== trump) return false
  }

  return true
}

const hasMarriage = (hand: Card[], suit: Suit): boolean => {
  return hand.some(c => c.suit === suit && c.rank === 'kiraly') &&
         hand.some(c => c.suit === suit && c.rank === 'felso')
}

export default function Snapszer() {
  const [game, setGame] = useState<GameState>(initGame)
  const [isAIThinking, setIsAIThinking] = useState(false)
  const [selectedMarriage, setSelectedMarriage] = useState<Suit | null>(null)

  const calculateTrickPoints = (cards: Card[]): number => {
    return cards.reduce((sum, card) => sum + SNAPSZER_VALUES[card.rank], 0)
  }

  const resolveTrick = useCallback((state: GameState): GameState => {
    const { currentTrick, trump, trickStarter } = state
    if (!currentTrick.player || !currentTrick.ai) return state

    const leadCard = trickStarter === 'player' ? currentTrick.player : currentTrick.ai
    const leadSuit = leadCard.suit

    const playerStrength = getCardStrength(currentTrick.player, trump, leadSuit)
    const aiStrength = getCardStrength(currentTrick.ai, trump, leadSuit)

    const trickCards = [currentTrick.player, currentTrick.ai]
    const trickPoints = calculateTrickPoints(trickCards)
    const playerWins = playerStrength > aiStrength

    const newState = { ...state }

    if (playerWins) {
      newState.playerTricks = [...state.playerTricks, ...trickCards]
      newState.playerPoints = state.playerPoints + trickPoints
      newState.currentPlayer = 'player'
      newState.trickStarter = 'player'
      newState.lastAction = `Megnyerted az ütést! (+${trickPoints} pont)`
    } else {
      newState.aiTricks = [...state.aiTricks, ...trickCards]
      newState.aiPoints = state.aiPoints + trickPoints
      newState.currentPlayer = 'ai'
      newState.trickStarter = 'ai'
      newState.lastAction = `A gép nyerte az ütést. (+${trickPoints} pont)`
    }

    newState.currentTrick = { player: null, ai: null }

    // Draw cards if deck open
    if (!state.deckClosed && state.deck.length > 0) {
      const winner = playerWins ? 'player' : 'ai'
      if (winner === 'player') {
        if (state.deck.length > 0) {
          newState.playerHand = [...state.playerHand, state.deck[0]]
          newState.deck = state.deck.slice(1)
        }
        if (newState.deck.length > 0) {
          newState.aiHand = [...state.aiHand, newState.deck[0]]
          newState.deck = newState.deck.slice(1)
        } else if (state.trumpCard) {
          newState.aiHand = [...state.aiHand, state.trumpCard]
          newState.trumpCard = null
        }
      } else {
        if (state.deck.length > 0) {
          newState.aiHand = [...state.aiHand, state.deck[0]]
          newState.deck = state.deck.slice(1)
        }
        if (newState.deck.length > 0) {
          newState.playerHand = [...state.playerHand, newState.deck[0]]
          newState.deck = newState.deck.slice(1)
        } else if (state.trumpCard) {
          newState.playerHand = [...state.playerHand, state.trumpCard]
          newState.trumpCard = null
        }
      }
    } else if (!state.deckClosed && state.trumpCard && state.deck.length === 0) {
      // Last card from trump
      const winner = playerWins ? 'player' : 'ai'
      if (winner === 'player') {
        newState.playerHand = [...state.playerHand, state.trumpCard]
      } else {
        newState.aiHand = [...state.aiHand, state.trumpCard]
      }
      newState.trumpCard = null
    }

    // Check for win
    if (newState.playerPoints >= WINNING_SCORE) {
      newState.gamePhase = 'finished'
      newState.roundWinner = 'player'
      newState.lastAction = '🎉 Elérted a 66 pontot! Te nyertél!'
    } else if (newState.aiPoints >= WINNING_SCORE) {
      newState.gamePhase = 'finished'
      newState.roundWinner = 'ai'
      newState.lastAction = '🤖 A gép elérte a 66 pontot!'
    } else if (newState.playerHand.length === 0 && newState.aiHand.length === 0) {
      // All cards played
      newState.gamePhase = 'finished'
      // Last trick winner gets 10 bonus
      if (playerWins) {
        newState.playerPoints += 10
      } else {
        newState.aiPoints += 10
      }
      newState.roundWinner = newState.playerPoints > newState.aiPoints ? 'player' : 'ai'
    }

    return newState
  }, [])

  const playCard = (card: Card, marriage?: Suit) => {
    if (game.currentPlayer !== 'player' || isAIThinking) return

    const leadCard = game.trickStarter === 'ai' ? game.currentTrick.ai : null

    if (!canPlayCard(card, game.playerHand, leadCard, game.trump, game.deckClosed)) {
      return
    }

    let newState = { ...game }

    // Handle marriage announcement
    if (marriage && game.trickStarter === 'player' && !game.currentTrick.player) {
      const marriagePoints = marriage === game.trump ? 40 : 20
      newState.playerPoints += marriagePoints
      newState.playerMarriages = [...game.playerMarriages, marriage]
      newState.lastAction = `Bemondtál ${marriage === game.trump ? '40' : '20'}-at! (${SUIT_SYMBOLS[marriage]})`
      setSelectedMarriage(null)

      if (newState.playerPoints >= WINNING_SCORE) {
        newState.gamePhase = 'finished'
        newState.roundWinner = 'player'
        setGame(newState)
        return
      }
    }

    newState.playerHand = game.playerHand.filter(c => c.id !== card.id)
    newState.currentTrick = { ...game.currentTrick, player: card }

    if (game.currentTrick.ai) {
      // Second card played, resolve trick
      newState = resolveTrick(newState)
    } else {
      newState.currentPlayer = 'ai'
      if (!marriage) {
        newState.lastAction = `Letettél: ${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`
      }
    }

    setGame(newState)
  }

  const closeDeck = () => {
    if (game.deckClosed || game.currentPlayer !== 'player') return
    setGame({
      ...game,
      deckClosed: true,
      closedBy: 'player',
      lastAction: 'Bezártad a paklit!'
    })
  }

  const aiPlay = useCallback(() => {
    setIsAIThinking(true)

    setTimeout(() => {
      setGame(prevGame => {
        if (prevGame.currentPlayer !== 'ai' || prevGame.gamePhase === 'finished') {
          setIsAIThinking(false)
          return prevGame
        }

        let newState = { ...prevGame }
        const hand = [...newState.aiHand]

        if (hand.length === 0) {
          setIsAIThinking(false)
          return newState
        }

        const leadCard = prevGame.trickStarter === 'player' ? prevGame.currentTrick.player : null

        // Check for marriage announcement (when AI starts trick)
        if (prevGame.trickStarter === 'ai' && !prevGame.currentTrick.ai) {
          for (const suit of ['piros', 'tok', 'zold', 'makk'] as Suit[]) {
            if (!prevGame.aiMarriages.includes(suit) && hasMarriage(hand, suit)) {
              const marriagePoints = suit === prevGame.trump ? 40 : 20
              newState.aiPoints += marriagePoints
              newState.aiMarriages = [...prevGame.aiMarriages, suit]
              newState.lastAction = `Gép bemondott ${marriagePoints}-at! (${SUIT_SYMBOLS[suit]})`

              if (newState.aiPoints >= WINNING_SCORE) {
                newState.gamePhase = 'finished'
                newState.roundWinner = 'ai'
                setIsAIThinking(false)
                return newState
              }
              break
            }
          }
        }

        // Filter playable cards
        let playableCards = hand.filter(c =>
          canPlayCard(c, hand, leadCard, prevGame.trump, prevGame.deckClosed)
        )
        if (playableCards.length === 0) playableCards = hand

        // AI strategy: beat if possible, save trumps
        let cardToPlay: Card

        if (leadCard) {
          // Try to beat with minimum strength
          const winningCards = playableCards.filter(c =>
            getCardStrength(c, prevGame.trump, leadCard.suit) >
            getCardStrength(leadCard, prevGame.trump, leadCard.suit)
          )

          if (winningCards.length > 0) {
            // Play lowest winning card
            winningCards.sort((a, b) =>
              getCardStrength(a, prevGame.trump, leadCard.suit) -
              getCardStrength(b, prevGame.trump, leadCard.suit)
            )
            cardToPlay = winningCards[0]
          } else {
            // Can't win, play lowest value
            playableCards.sort((a, b) => SNAPSZER_VALUES[a.rank] - SNAPSZER_VALUES[b.rank])
            cardToPlay = playableCards[0]
          }
        } else {
          // AI leads: play high cards or try to find tricks
          playableCards.sort((a, b) => SNAPSZER_VALUES[b.rank] - SNAPSZER_VALUES[a.rank])
          // Avoid leading with trump unless necessary
          const nonTrumpCards = playableCards.filter(c => c.suit !== prevGame.trump)
          cardToPlay = nonTrumpCards.length > 0 ? nonTrumpCards[0] : playableCards[0]
        }

        newState.aiHand = hand.filter(c => c.id !== cardToPlay.id)
        newState.currentTrick = { ...newState.currentTrick, ai: cardToPlay }

        if (prevGame.currentTrick.player) {
          // Second card, resolve trick
          newState = resolveTrick(newState)
        } else {
          newState.currentPlayer = 'player'
          newState.lastAction = `Gép letett: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`
        }

        setIsAIThinking(false)
        return newState
      })
    }, 1000)
  }, [resolveTrick])

  useEffect(() => {
    if (game.currentPlayer === 'ai' && game.gamePhase === 'playing' && !isAIThinking) {
      aiPlay()
    }
  }, [game.currentPlayer, game.gamePhase, isAIThinking, aiPlay])

  const resetGame = () => {
    setGame(initGame())
    setIsAIThinking(false)
    setSelectedMarriage(null)
  }

  const getPlayableMarriages = (): Suit[] => {
    if (game.trickStarter !== 'player' || game.currentTrick.player) return []
    const marriages: Suit[] = []
    for (const suit of ['piros', 'tok', 'zold', 'makk'] as Suit[]) {
      if (!game.playerMarriages.includes(suit) && hasMarriage(game.playerHand, suit)) {
        marriages.push(suit)
      }
    }
    return marriages
  }

  const renderCard = (card: Card, onClick?: () => void, disabled?: boolean, highlight?: boolean) => (
    <div
      key={card.id}
      className={`hungarian-card ${onClick && !disabled ? 'playable' : ''} ${disabled ? 'disabled' : ''} ${highlight ? 'highlight' : ''}`}
      onClick={() => onClick && !disabled && onClick()}
    >
      <img
        src={getCardImagePath(card.suit, card.rank)}
        alt={`${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`}
        draggable={false}
      />
    </div>
  )

  const playableMarriages = getPlayableMarriages()

  return (
    <div className="snapszer">
      <div className="game-header">
        <div className="scores">
          <span className={game.currentPlayer === 'player' ? 'active' : ''}>
            👤 {game.playerPoints}/{WINNING_SCORE}
          </span>
          <span> - </span>
          <span className={game.currentPlayer === 'ai' ? 'active' : ''}>
            🤖 {game.aiPoints}/{WINNING_SCORE}
          </span>
        </div>
        <div className="trump-info">
          Adu: {SUIT_SYMBOLS[game.trump]}
          {game.deckClosed && ' 🔒'}
        </div>
      </div>

      <div className="game-status">{game.lastAction}</div>

      {game.gamePhase === 'finished' ? (
        <div className="game-over">
          <h2>{game.roundWinner === 'player' ? '🎉 Te nyertél!' : '🤖 A gép nyert!'}</h2>
          <p>👤 Te: {game.playerPoints} | 🤖 Gép: {game.aiPoints}</p>
          <button className="btn-primary" onClick={resetGame}>
            🔄 Új játék
          </button>
        </div>
      ) : (
        <>
          {/* AI hand */}
          <div className="ai-hand">
            <div className="hand-label">🤖 Gép ({game.aiHand.length} lap)</div>
            <div className="cards">
              {game.aiHand.map((_, i) => (
                <div key={i} className="hungarian-card back">
                  <img src={getCardBackPath()} alt="Kártya hátlap" draggable={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Trick area */}
          <div className="trick-area">
            <div className="trick-cards">
              <div className="trick-card-slot">
                {game.currentTrick.ai && renderCard(game.currentTrick.ai)}
                {!game.currentTrick.ai && <div className="empty-slot">🤖</div>}
              </div>
              <div className="vs-separator">VS</div>
              <div className="trick-card-slot">
                {game.currentTrick.player && renderCard(game.currentTrick.player)}
                {!game.currentTrick.player && <div className="empty-slot">👤</div>}
              </div>
            </div>

            {/* Trump card and deck */}
            <div className="deck-area">
              {game.trumpCard && (
                <div className="trump-card">
                  {renderCard(game.trumpCard)}
                  <span className="trump-label">Adu</span>
                </div>
              )}
              {game.deck.length > 0 && (
                <div className="deck-pile">
                  <div className="hungarian-card back small">
                    <img src={getCardBackPath()} alt="Pakli" draggable={false} />
                  </div>
                  <span className="deck-count">{game.deck.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Marriage announcement */}
          {playableMarriages.length > 0 && (
            <div className="marriage-buttons">
              <span>Bemondás: </span>
              {playableMarriages.map(suit => (
                <button
                  key={suit}
                  className={`marriage-btn ${selectedMarriage === suit ? 'selected' : ''}`}
                  onClick={() => setSelectedMarriage(selectedMarriage === suit ? null : suit)}
                >
                  {SUIT_SYMBOLS[suit]} {suit === game.trump ? '40' : '20'}
                </button>
              ))}
            </div>
          )}

          {/* Close deck button */}
          {!game.deckClosed && game.deck.length > 0 && game.currentPlayer === 'player' && (
            <button className="close-deck-btn" onClick={closeDeck}>
              🔒 Pakli bezárása
            </button>
          )}

          {/* Player hand */}
          <div className="player-hand">
            <div className="hand-label">👤 Te ({game.playerHand.length} lap)</div>
            <div className="cards">
              {game.playerHand.map(card => {
                const leadCard = game.trickStarter === 'ai' ? game.currentTrick.ai : null
                const canPlay = canPlayCard(card, game.playerHand, leadCard, game.trump, game.deckClosed)
                const isMarriageCard = !!(selectedMarriage &&
                  card.suit === selectedMarriage &&
                  (card.rank === 'kiraly' || card.rank === 'felso'))

                return renderCard(
                  card,
                  () => playCard(card, isMarriageCard ? selectedMarriage : undefined),
                  game.currentPlayer !== 'player' || isAIThinking || !canPlay,
                  isMarriageCard
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
