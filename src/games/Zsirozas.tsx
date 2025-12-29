import { useState, useEffect, useCallback } from 'react'
import { usePlayerName } from '../contexts/PlayerNameContext'
import type { Card, Rank } from './hungarianCards'
import {
  createDeck,
  shuffleDeck,
  SUIT_SYMBOLS,
  RANK_NAMES,
} from './hungarianCards'
import { getCardImagePath, getCardBackPath } from './cardImages'
import './Zsirozas.css'

type Player = 'player' | 'ai'

interface PileCard {
  card: Card
  playedBy: Player
}

interface GameState {
  deck: Card[]
  playerHand: Card[]
  aiHand: Card[]
  pile: PileCard[]
  playerWon: Card[]
  aiWon: Card[]
  currentPlayer: Player       // Whose turn it is
  baseRank: Rank | null       // First card's rank in the round
  lastHitter: Player | null   // Who hit last (owns the pile)
  gamePhase: 'playing' | 'finished'
  message: string
}

const HAND_SIZE = 4

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

// Draw cards - split remaining cards evenly if not enough for both to have 4
const drawCards = (state: GameState): GameState => {
  const newState = { ...state }
  const deck = [...newState.deck]

  const playerNeeds = HAND_SIZE - newState.playerHand.length
  const aiNeeds = HAND_SIZE - newState.aiHand.length
  const totalNeeds = playerNeeds + aiNeeds

  if (deck.length >= totalNeeds) {
    // Enough cards for both
    while (deck.length > 0 && newState.playerHand.length < HAND_SIZE) {
      newState.playerHand = [...newState.playerHand, deck.shift()!]
    }
    while (deck.length > 0 && newState.aiHand.length < HAND_SIZE) {
      newState.aiHand = [...newState.aiHand, deck.shift()!]
    }
  } else {
    // Not enough - split evenly
    const totalToDistribute = deck.length
    const eachGets = Math.floor(totalToDistribute / 2)
    const remainder = totalToDistribute % 2

    // Player draws first (or could alternate)
    for (let i = 0; i < eachGets + remainder && deck.length > 0; i++) {
      newState.playerHand = [...newState.playerHand, deck.shift()!]
    }
    for (let i = 0; i < eachGets && deck.length > 0; i++) {
      newState.aiHand = [...newState.aiHand, deck.shift()!]
    }
  }

  newState.deck = deck
  return newState
}

const initGame = (): GameState => {
  const deck = shuffleDeck(createDeck())
  const playerHand = deck.slice(0, HAND_SIZE)
  const aiHand = deck.slice(HAND_SIZE, HAND_SIZE * 2)
  const remainingDeck = deck.slice(HAND_SIZE * 2)

  return {
    deck: remainingDeck,
    playerHand,
    aiHand,
    pile: [],
    playerWon: [],
    aiWon: [],
    currentPlayer: 'player',
    baseRank: null,
    lastHitter: null,
    gamePhase: 'playing',
    message: 'Kezdd a játékot! Tegyél le egy lapot.',
  }
}

export default function Zsirozas() {
  const { playerName } = usePlayerName()
  const [game, setGame] = useState<GameState>(initGame)
  const [isAIThinking, setIsAIThinking] = useState(false)

  // Take the pile - lastHitter collects all cards
  const takePile = useCallback((state: GameState): GameState => {
    const winner = state.lastHitter!
    const pileCards = state.pile.map(p => p.card)

    let newState: GameState = {
      ...state,
      pile: [],
      baseRank: null,
      lastHitter: null,
      currentPlayer: winner,
    }

    if (winner === 'player') {
      newState.playerWon = [...newState.playerWon, ...pileCards]
      newState.message = `🎉 ${playerName} bevitte a paklit (${pileCards.length} lap)!`
    } else {
      newState.aiWon = [...newState.aiWon, ...pileCards]
      newState.message = `🤖 Gép bevitte a paklit (${pileCards.length} lap).`
    }

    // Draw cards
    newState = drawCards(newState)

    // Check game end
    if (newState.playerHand.length === 0 && newState.aiHand.length === 0) {
      newState.gamePhase = 'finished'
    }

    return newState
  }, [playerName])

  // Player explicitly takes the pile (when they are lastHitter)
  const playerTakesPile = () => {
    if (game.lastHitter !== 'player' || game.pile.length === 0) return
    setGame(prev => takePile(prev))
  }

  // Player plays a card
  const playCard = (card: Card) => {
    if (game.currentPlayer !== 'player' || isAIThinking || game.gamePhase === 'finished') return

    const cardName = `${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`

    let newState: GameState = {
      ...game,
      playerHand: game.playerHand.filter(c => c.id !== card.id),
      pile: [...game.pile, { card, playedBy: 'player' }],
    }

    if (game.baseRank === null) {
      // Starting new round - first card sets baseRank, player is lastHitter
      newState.baseRank = card.rank
      newState.lastHitter = 'player'
      newState.currentPlayer = 'ai'
      newState.message = `${playerName} hívott: ${cardName}`
    } else {
      // Responding to existing round
      if (canHit(card, game.baseRank)) {
        // HIT - player becomes/stays lastHitter
        newState.lastHitter = 'player'
        newState.currentPlayer = 'ai'
        newState.message = card.rank === '7'
          ? `🎯 ${playerName} hetessel ütött!`
          : `🎯 ${playerName} ütött: ${cardName}!`
      } else {
        // Non-hitting card
        if (game.lastHitter === 'player') {
          // Player is already lastHitter, just adding a card, AI's turn
          newState.currentPlayer = 'ai'
          newState.message = `${playerName}: ${cardName}`
        } else {
          // Player is NOT lastHitter - this is a PASS, AI takes pile
          newState.message = `${playerName} passzolt - gép viszi!`
          setGame(newState)
          setTimeout(() => {
            setGame(prev => takePile(prev))
          }, 1000)
          return
        }
      }
    }

    setGame(newState)
  }

  // AI plays
  const aiPlay = useCallback(() => {
    setIsAIThinking(true)

    setTimeout(() => {
      setGame(prevGame => {
        if (prevGame.currentPlayer !== 'ai' || prevGame.gamePhase === 'finished') {
          setIsAIThinking(false)
          return prevGame
        }

        const hand = [...prevGame.aiHand]
        if (hand.length === 0) {
          setIsAIThinking(false)
          return prevGame
        }

        let cardToPlay: Card
        let newState: GameState

        if (prevGame.baseRank === null) {
          // AI starts new round - play lowest value card (avoid zsír and 7)
          hand.sort((a, b) => {
            const aScore = isZsir(a) ? 100 : (a.rank === '7' ? 50 : 0)
            const bScore = isZsir(b) ? 100 : (b.rank === '7' ? 50 : 0)
            return aScore - bScore
          })
          cardToPlay = hand[0]

          newState = {
            ...prevGame,
            aiHand: hand.filter(c => c.id !== cardToPlay.id),
            pile: [{ card: cardToPlay, playedBy: 'ai' }],
            baseRank: cardToPlay.rank,
            lastHitter: 'ai',
            currentPlayer: 'player',
            message: `🤖 Gép hívott: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`,
          }

          setIsAIThinking(false)
          return newState
        }

        // AI responding to existing round
        const hittingCards = hand.filter(c => canHit(c, prevGame.baseRank))
        const pileHasZsir = prevGame.pile.some(p => isZsir(p.card))

        // Decision: should AI hit?
        // Hit if: pile has zsír OR AI is already lastHitter (defend position)
        const shouldHit = hittingCards.length > 0 && (pileHasZsir || prevGame.lastHitter === 'ai')

        // Decision: should AI take the pile? (if AI is lastHitter)
        // Take if: pile has zsír and no need to defend
        const shouldTake = prevGame.lastHitter === 'ai' && pileHasZsir && !hasHittingCard(hand, prevGame.baseRank)

        if (shouldTake) {
          // AI takes the pile
          const afterTake = takePile(prevGame)
          setIsAIThinking(false)
          return afterTake
        }

        if (shouldHit) {
          // HIT - prefer matching rank over 7
          const matchingCard = hittingCards.find(c => c.rank === prevGame.baseRank)
          cardToPlay = matchingCard || hittingCards[0]

          newState = {
            ...prevGame,
            aiHand: hand.filter(c => c.id !== cardToPlay.id),
            pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
            lastHitter: 'ai',
            currentPlayer: 'player',
            message: cardToPlay.rank === '7'
              ? `🤖 Gép hetessel ütött!`
              : `🤖 Gép ütött: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}!`,
          }

          setIsAIThinking(false)
          return newState
        } else {
          // AI doesn't want to hit or can't hit

          if (prevGame.lastHitter === 'ai') {
            // AI is lastHitter - can just take the pile or add a card
            // If pile has zsír, take it
            if (pileHasZsir) {
              const afterTake = takePile(prevGame)
              setIsAIThinking(false)
              return afterTake
            }

            // Otherwise, play a low-value card to continue
            const nonHitting = hand.filter(c => !canHit(c, prevGame.baseRank))
            if (nonHitting.length > 0) {
              nonHitting.sort((a, b) => {
                const aScore = isZsir(a) ? 100 : 0
                const bScore = isZsir(b) ? 100 : 0
                return aScore - bScore
              })
              cardToPlay = nonHitting[0]
            } else {
              // All cards are hitting cards - must play one
              cardToPlay = hittingCards[0]
              // This is actually a hit
              newState = {
                ...prevGame,
                aiHand: hand.filter(c => c.id !== cardToPlay.id),
                pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
                lastHitter: 'ai',
                currentPlayer: 'player',
                message: `🤖 Gép: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`,
              }
              setIsAIThinking(false)
              return newState
            }

            newState = {
              ...prevGame,
              aiHand: hand.filter(c => c.id !== cardToPlay.id),
              pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
              currentPlayer: 'player',
              message: `🤖 Gép: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`,
            }
            setIsAIThinking(false)
            return newState
          } else {
            // AI is NOT lastHitter - must pass (play non-hitting card, player takes pile)
            const nonHitting = hand.filter(c => !canHit(c, prevGame.baseRank))
            if (nonHitting.length > 0) {
              nonHitting.sort((a, b) => {
                const aScore = isZsir(a) ? 100 : 0
                const bScore = isZsir(b) ? 100 : 0
                return aScore - bScore
              })
              cardToPlay = nonHitting[0]
            } else {
              // All cards hit - forced to hit (becomes lastHitter)
              cardToPlay = hittingCards[0]
              newState = {
                ...prevGame,
                aiHand: hand.filter(c => c.id !== cardToPlay.id),
                pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
                lastHitter: 'ai',
                currentPlayer: 'player',
                message: `🤖 Gép ütött: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}!`,
              }
              setIsAIThinking(false)
              return newState
            }

            // Real pass
            newState = {
              ...prevGame,
              aiHand: hand.filter(c => c.id !== cardToPlay.id),
              pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
              message: `🤖 Gép passzolt.`,
            }

            setTimeout(() => {
              setGame(prev => {
                const afterTake = takePile(prev)
                return afterTake
              })
            }, 1000)

            setIsAIThinking(false)
            return newState
          }
        }
      })
    }, 800)
  }, [takePile])

  // Trigger AI turn
  useEffect(() => {
    if (game.currentPlayer === 'ai' && game.gamePhase === 'playing' && !isAIThinking && game.aiHand.length > 0) {
      aiPlay()
    }
  }, [game.currentPlayer, game.gamePhase, game.aiHand.length, isAIThinking, aiPlay])

  // Handle edge cases
  useEffect(() => {
    if (game.gamePhase === 'finished') return

    const playerHasCards = game.playerHand.length > 0
    const aiHasCards = game.aiHand.length > 0

    // If neither has cards, game ends
    if (!playerHasCards && !aiHasCards) {
      if (game.pile.length > 0 && game.lastHitter) {
        setGame(prev => takePile(prev))
      } else {
        setGame(prev => ({ ...prev, gamePhase: 'finished' }))
      }
      return
    }

    // If current player has no cards but opponent does
    if (game.currentPlayer === 'player' && !playerHasCards && aiHasCards) {
      if (game.pile.length > 0 && game.lastHitter === 'player') {
        // Player is lastHitter but has no cards - take the pile
        setGame(prev => takePile(prev))
      } else {
        setGame(prev => ({ ...prev, currentPlayer: 'ai' }))
      }
    } else if (game.currentPlayer === 'ai' && !aiHasCards && playerHasCards) {
      if (game.pile.length > 0 && game.lastHitter === 'ai') {
        // AI is lastHitter but has no cards - take the pile
        setGame(prev => takePile(prev))
      } else {
        setGame(prev => ({ ...prev, currentPlayer: 'player' }))
      }
    }
  }, [game.playerHand.length, game.aiHand.length, game.currentPlayer, game.gamePhase, game.pile.length, game.lastHitter, takePile])

  const resetGame = () => {
    setGame(initGame())
    setIsAIThinking(false)
  }

  const playerPoints = countZsirPoints(game.playerWon)
  const aiPoints = countZsirPoints(game.aiWon)

  const getWinner = () => {
    if (playerPoints > aiPoints) return `🎉 ${playerName} nyertél!`
    if (aiPoints > playerPoints) return '🤖 A gép nyert!'
    return '🤝 Döntetlen!'
  }

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

  // Can player take the pile?
  const canTakePile = game.lastHitter === 'player' && game.pile.length > 0 && game.currentPlayer === 'player'

  return (
    <div className="zsirozas">
      <div className="game-header">
        <div className="scores">
          <span className={game.currentPlayer === 'player' ? 'active' : ''}>
            👤 {playerName}: {playerPoints} zsír
          </span>
          <span> - </span>
          <span className={game.currentPlayer === 'ai' ? 'active' : ''}>
            🤖 {aiPoints} zsír
          </span>
        </div>
        <div className="deck-info">
          📚 Pakli: {game.deck.length}
        </div>
      </div>

      <div className="game-status">{game.message}</div>

      {game.gamePhase === 'playing' && (
        <div className="turn-indicator">
          {isAIThinking ? (
            <span className="thinking">🤖 A gép gondolkodik...</span>
          ) : game.currentPlayer === 'player' && game.playerHand.length > 0 ? (
            game.pile.length === 0 ? (
              <span className="your-turn">👆 Kezdj új kört - tegyél le egy lapot!</span>
            ) : game.lastHitter === 'ai' ? (
              <span className="your-turn">
                ⚡ A gép ütött!
                <span className="hint">
                  {hasHittingCard(game.playerHand, game.baseRank)
                    ? ` Üss vissza (${RANK_NAMES[game.baseRank!]} vagy 7) vagy passz más lappal!`
                    : ` Nincs ütő lapod - tegyél le bármit (passz).`}
                </span>
              </span>
            ) : (
              <div className="zsir-decision">
                <span className="your-turn">
                  ✅ Te vagy az ütő!
                  <span className="hint"> Viheted a paklit vagy folytathatod.</span>
                </span>
                {canTakePile && (
                  <button className="btn-take" onClick={playerTakesPile}>
                    🏆 Beviszem a paklit!
                  </button>
                )}
              </div>
            )
          ) : null}
        </div>
      )}

      {game.gamePhase === 'finished' ? (
        <div className="game-over">
          <h2>{getWinner()}</h2>
          <p>👤 {playerName}: {playerPoints} zsír | 🤖 Gép: {aiPoints} zsír</p>
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

          {/* Pile */}
          <div className="pile-area">
            <div className="pile-label">
              Asztal ({game.pile.length} lap)
              {game.lastHitter && <span className="pile-owner"> - {game.lastHitter === 'player' ? '👤 Tiéd' : '🤖 Gépé'}</span>}
            </div>
            <div className="pile">
              {game.pile.length === 0 ? (
                <div className="empty-pile">Üres</div>
              ) : (
                game.pile.map((pileCard, i) => (
                  <div key={pileCard.card.id} className="pile-card-wrapper" style={{ marginLeft: i > 0 ? -40 : 0 }}>
                    <div className={`pile-card-owner ${pileCard.playedBy}`}>
                      {pileCard.playedBy === 'player' ? '👤' : '🤖'}
                    </div>
                    {renderCard(pileCard.card)}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player hand */}
          <div className="player-hand">
            <div className="hand-label">👤 {playerName} ({game.playerHand.length} lap)</div>
            <div className="cards">
              {game.playerHand.map(card =>
                renderCard(
                  card,
                  () => playCard(card),
                  game.currentPlayer !== 'player' || isAIThinking
                )
              )}
            </div>
          </div>

          {/* Won cards info */}
          <div className="won-cards-info">
            <span>👤 Bevitt: {game.playerWon.length} lap ({playerPoints} zsír)</span>
            <span>🤖 Bevitt: {game.aiWon.length} lap ({aiPoints} zsír)</span>
          </div>
        </>
      )}
    </div>
  )
}
