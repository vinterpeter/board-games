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
  roundStarter: Player | null // Who started (called) the round - only they can pass/take
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
    roundStarter: null,
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
    // Safety check - must have a lastHitter and pile
    if (!state.lastHitter || state.pile.length === 0) {
      console.log('takePile skipped - no lastHitter or empty pile')
      return state
    }

    const winner = state.lastHitter
    const pileCards = state.pile.map(p => p.card)

    let newState: GameState = {
      ...state,
      pile: [],
      baseRank: null,
      lastHitter: null,
      roundStarter: null,  // Reset for new round
      currentPlayer: winner,  // Winner starts next round
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

    console.log('takePile result:', { winner, newCurrentPlayer: newState.currentPlayer })
    return newState
  }, [playerName])

  // Player passes - only available when player is roundStarter and not lastHitter
  const playerPasses = () => {
    if (game.roundStarter !== 'player' || game.lastHitter === 'player' || game.pile.length === 0 || game.currentPlayer !== 'player') return
    setIsAIThinking(true)  // Block input
    setGame(prev => ({
      ...prev,
      message: `${playerName} passzolt - gép viszi!`
    }))
    setTimeout(() => {
      setGame(prev => takePile(prev))
      setIsAIThinking(false)
    }, 1000)
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
      // Starting new round - first card sets baseRank, player is lastHitter and roundStarter
      newState.baseRank = card.rank
      newState.lastHitter = 'player'
      newState.roundStarter = 'player'
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
        newState.currentPlayer = 'ai'
        newState.message = `${playerName}: ${cardName}`

        // If player is responder and didn't hit, check if AI (roundStarter) auto-takes
        if (game.roundStarter === 'ai' && game.lastHitter === 'ai') {
          // AI is roundStarter and still lastHitter - auto takes pile
          setGame(newState)
          setIsAIThinking(true)
          setTimeout(() => {
            setGame(prev => takePile(prev))
            setIsAIThinking(false)
          }, 800)
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
            roundStarter: 'ai',  // AI is the caller
            currentPlayer: 'player',
            message: `🤖 Gép hívott: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`,
          }

          setTimeout(() => setIsAIThinking(false), 2000)
          return newState
        }

        // AI responding to existing round
        const hittingCards = hand.filter(c => canHit(c, prevGame.baseRank))
        const nonHittingCards = hand.filter(c => !canHit(c, prevGame.baseRank))
        const pileHasZsir = prevGame.pile.some(p => isZsir(p.card))
        const isRoundStarter = prevGame.roundStarter === 'ai'
        const isLastHitter = prevGame.lastHitter === 'ai'

        // Sort cards by value (prefer playing low-value cards)
        const sortByValue = (cards: Card[]) => {
          return [...cards].sort((a, b) => {
            const aScore = isZsir(a) ? 100 : (a.rank === '7' ? 50 : 0)
            const bScore = isZsir(b) ? 100 : (b.rank === '7' ? 50 : 0)
            return aScore - bScore
          })
        }

        // CASE 1: AI is the round starter (hívó)
        if (isRoundStarter) {
          if (isLastHitter) {
            // AI called and is still the hitter - AUTO TAKE (responder didn't hit)
            const afterTake = takePile(prevGame)
            setIsAIThinking(false)
            return afterTake
          } else {
            // AI called but player hit - AI can hit back or auto-pass if no hitting cards
            if (hittingCards.length > 0 && pileHasZsir) {
              // Hit back to defend zsír
              cardToPlay = hittingCards.find(c => c.rank === prevGame.baseRank) || hittingCards[0]
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
              setTimeout(() => setIsAIThinking(false), 2000)
              return newState
            } else {
              // AUTO PASS - no hitting cards or doesn't want to hit
              newState = {
                ...prevGame,
                currentPlayer: 'player',
                message: hittingCards.length === 0
                  ? `🤖 Gépnek nincs ütő lapja - ${playerName} viszi!`
                  : `🤖 Gép passzolt.`,
              }
              setTimeout(() => {
                setGame(prev => takePile(prev))
                setIsAIThinking(false)
              }, 2000)
              return newState
            }
          }
        }

        // CASE 2: AI is NOT the round starter (válaszoló) - MUST play a card
        else {
          // Decide what card to play
          if (hittingCards.length > 0 && (pileHasZsir || isLastHitter)) {
            // Hit if pile has zsír or to defend position
            cardToPlay = hittingCards.find(c => c.rank === prevGame.baseRank) || hittingCards[0]
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
            setTimeout(() => setIsAIThinking(false), 2000)
            return newState
          } else if (nonHittingCards.length > 0) {
            // Play non-hitting card (doesn't want to hit or can't)
            cardToPlay = sortByValue(nonHittingCards)[0]
            newState = {
              ...prevGame,
              aiHand: hand.filter(c => c.id !== cardToPlay.id),
              pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
              currentPlayer: 'player',
              message: `🤖 Gép: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`,
            }
            setTimeout(() => setIsAIThinking(false), 2000)
            return newState
          } else {
            // Only hitting cards - forced to hit
            cardToPlay = sortByValue(hittingCards)[0]
            newState = {
              ...prevGame,
              aiHand: hand.filter(c => c.id !== cardToPlay.id),
              pile: [...prevGame.pile, { card: cardToPlay, playedBy: 'ai' }],
              lastHitter: 'ai',
              currentPlayer: 'player',
              message: `🤖 Gép ütött: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}!`,
            }
            setTimeout(() => setIsAIThinking(false), 2000)
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

  // Auto-take/auto-pass for player when they are roundStarter
  useEffect(() => {
    if (game.currentPlayer !== 'player' || game.gamePhase !== 'playing' || isAIThinking) return
    if (game.roundStarter !== 'player' || game.pile.length === 0) return

    if (game.lastHitter === 'player') {
      // Player is roundStarter and lastHitter - AUTO TAKE
      setTimeout(() => {
        setGame(prev => takePile(prev))
      }, 500)
    } else if (!hasHittingCard(game.playerHand, game.baseRank)) {
      // Player is roundStarter, not lastHitter, and has no hitting cards - AUTO PASS
      setIsAIThinking(true)
      setGame(prev => ({
        ...prev,
        message: `${playerName}nak nincs ütő lapja - gép viszi!`
      }))
      setTimeout(() => {
        setGame(prev => takePile(prev))
        setIsAIThinking(false)
      }, 1000)
    }
  }, [game.currentPlayer, game.gamePhase, game.roundStarter, game.lastHitter, game.pile.length, game.playerHand, game.baseRank, isAIThinking, playerName, takePile])

  // Handle edge cases and recovery
  useEffect(() => {
    if (game.gamePhase === 'finished') return

    const playerHasCards = game.playerHand.length > 0
    const aiHasCards = game.aiHand.length > 0

    // Recovery: if currentPlayer is somehow invalid, fix it
    if (game.currentPlayer !== 'player' && game.currentPlayer !== 'ai') {
      console.error('Invalid currentPlayer detected, recovering...', game.currentPlayer)
      // Default to whoever has cards, or player
      const newCurrent = playerHasCards ? 'player' : aiHasCards ? 'ai' : 'player'
      setGame(prev => ({ ...prev, currentPlayer: newCurrent }))
      return
    }

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
        setGame(prev => takePile(prev))
      } else {
        setGame(prev => ({ ...prev, currentPlayer: 'ai' }))
      }
    } else if (game.currentPlayer === 'ai' && !aiHasCards && playerHasCards) {
      if (game.pile.length > 0 && game.lastHitter === 'ai') {
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

  return (
    <div className="zsirozas">
      <div className="game-header">
        <span className={`score-left ${game.currentPlayer === 'player' ? 'active' : ''}`}>
          👤 {playerPoints}
        </span>
        <span className={`score-right ${game.currentPlayer === 'ai' ? 'active' : ''}`}>
          🤖 {aiPoints}
        </span>
      </div>

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
            <div className="hand-label">🤖 Gép</div>
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
            <div className="pile-row">
              <div className="pile">
                {game.pile.length === 0 ? (
                  <div className="empty-pile"></div>
                ) : (
                  game.pile.map((pileCard, i) => (
                    <div key={pileCard.card.id} className="pile-card-wrapper" style={{ marginLeft: i > 0 ? -50 : 0 }}>
                      {renderCard(pileCard.card)}
                    </div>
                  ))
                )}
              </div>
              {/* Pass button - only show when player can pass */}
              {game.currentPlayer === 'player' &&
               game.roundStarter === 'player' &&
               game.lastHitter !== 'player' &&
               game.pile.length > 0 &&
               hasHittingCard(game.playerHand, game.baseRank) &&
               !isAIThinking && (
                <button className="btn-pass" onClick={playerPasses}>
                  ✋ Passz
                </button>
              )}
            </div>
          </div>

          {/* Player hand */}
          <div className="player-hand">
            <div className="hand-label">👤 {playerName}</div>
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

        </>
      )}
    </div>
  )
}
