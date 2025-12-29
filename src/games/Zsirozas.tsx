import { useState, useEffect, useCallback } from 'react'
import type { Card } from './hungarianCards'
import {
  createDeck,
  shuffleDeck,
  SUIT_SYMBOLS,
  RANK_NAMES,
  ZSIROZAS_VALUES,
  calculateZsirozasPoints
} from './hungarianCards'
import { getCardImagePath, getCardBackPath } from './cardImages'
import './Zsirozas.css'

type Player = 'player' | 'ai'

interface GameState {
  deck: Card[]
  playerHand: Card[]
  aiHand: Card[]
  pile: Card[]
  playerWon: Card[]
  aiWon: Card[]
  currentPlayer: Player
  gamePhase: 'playing' | 'finished'
  lastAction: string
}

const HAND_SIZE = 4

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
    gamePhase: 'playing',
    lastAction: 'Kezdd a játékot! Tegyél le egy lapot.'
  }
}

export default function Zsirozas() {
  const [game, setGame] = useState<GameState>(initGame)
  const [isAIThinking, setIsAIThinking] = useState(false)

  const drawCards = useCallback((state: GameState): GameState => {
    const newState = { ...state }

    // Draw cards if deck has cards and hands are not full
    while (newState.deck.length > 0 && newState.playerHand.length < HAND_SIZE) {
      newState.playerHand = [...newState.playerHand, newState.deck[0]]
      newState.deck = newState.deck.slice(1)
    }
    while (newState.deck.length > 0 && newState.aiHand.length < HAND_SIZE) {
      newState.aiHand = [...newState.aiHand, newState.deck[0]]
      newState.deck = newState.deck.slice(1)
    }

    return newState
  }, [])

  const checkGameEnd = useCallback((state: GameState): GameState => {
    if (state.playerHand.length === 0 && state.aiHand.length === 0 && state.deck.length === 0) {
      // Give remaining pile to last player who took cards
      if (state.pile.length > 0) {
        // Pile goes to whoever played last
        if (state.currentPlayer === 'ai') {
          state.playerWon = [...state.playerWon, ...state.pile]
        } else {
          state.aiWon = [...state.aiWon, ...state.pile]
        }
        state.pile = []
      }
      return { ...state, gamePhase: 'finished' }
    }
    return state
  }, [])

  const playCard = (card: Card) => {
    if (game.currentPlayer !== 'player' || isAIThinking) return

    let newState = { ...game }
    newState.playerHand = newState.playerHand.filter(c => c.id !== card.id)

    if (newState.pile.length === 0) {
      // First card in pile
      newState.pile = [card]
      newState.currentPlayer = 'ai'
      newState.lastAction = `Letettél: ${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`
    } else {
      // Check if matches top of pile
      const topCard = newState.pile[newState.pile.length - 1]
      newState.pile = [...newState.pile, card]

      if (card.rank === topCard.rank) {
        // Zsír! Take the pile
        newState.playerWon = [...newState.playerWon, ...newState.pile]
        newState.pile = []
        newState.lastAction = `ZSÍR! Bevitted ${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}-val!`
        // Player continues
      } else {
        newState.currentPlayer = 'ai'
        newState.lastAction = `Letettél: ${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`
      }
    }

    newState = drawCards(newState)
    newState = checkGameEnd(newState)
    setGame(newState)
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
          return checkGameEnd(newState)
        }

        let cardToPlay: Card

        if (newState.pile.length === 0) {
          // AI starts: play lowest value card
          hand.sort((a, b) => ZSIROZAS_VALUES[a.rank] - ZSIROZAS_VALUES[b.rank])
          cardToPlay = hand[0]
          newState.pile = [cardToPlay]
          newState.currentPlayer = 'player'
          newState.lastAction = `Gép letett: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`
        } else {
          const topCard = newState.pile[newState.pile.length - 1]

          // Try to match for zsír
          const matchingCard = hand.find(c => c.rank === topCard.rank)

          if (matchingCard) {
            // AI can zsír!
            cardToPlay = matchingCard
            newState.pile = [...newState.pile, cardToPlay]
            newState.aiWon = [...newState.aiWon, ...newState.pile]
            newState.pile = []
            newState.lastAction = `Gép ZSÍR! ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`
            // AI continues after zsír
            newState.aiHand = hand.filter(c => c.id !== cardToPlay.id)
            newState = drawCards(newState)
            newState = checkGameEnd(newState)
            setIsAIThinking(false)

            // If AI has cards and game continues, AI plays again
            if (newState.gamePhase === 'playing' && newState.aiHand.length > 0) {
              setTimeout(() => aiPlay(), 800)
            }
            return newState
          } else {
            // No match - play lowest value
            hand.sort((a, b) => ZSIROZAS_VALUES[a.rank] - ZSIROZAS_VALUES[b.rank])
            cardToPlay = hand[0]
            newState.pile = [...newState.pile, cardToPlay]
            newState.currentPlayer = 'player'
            newState.lastAction = `Gép letett: ${SUIT_SYMBOLS[cardToPlay.suit]} ${RANK_NAMES[cardToPlay.rank]}`
          }
        }

        newState.aiHand = hand.filter(c => c.id !== cardToPlay.id)
        newState = drawCards(newState)
        newState = checkGameEnd(newState)
        setIsAIThinking(false)
        return newState
      })
    }, 800)
  }, [drawCards, checkGameEnd])

  useEffect(() => {
    if (game.currentPlayer === 'ai' && game.gamePhase === 'playing' && !isAIThinking) {
      aiPlay()
    }
  }, [game.currentPlayer, game.gamePhase, isAIThinking, aiPlay])

  const resetGame = () => {
    setGame(initGame())
    setIsAIThinking(false)
  }

  const playerPoints = calculateZsirozasPoints(game.playerWon)
  const aiPoints = calculateZsirozasPoints(game.aiWon)

  const getWinner = () => {
    if (playerPoints > aiPoints) return '🎉 Te nyertél!'
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
        <div className="scores">
          <span className={game.currentPlayer === 'player' ? 'active' : ''}>
            👤 {playerPoints} pont
          </span>
          <span> - </span>
          <span className={game.currentPlayer === 'ai' ? 'active' : ''}>
            🤖 {aiPoints} pont
          </span>
        </div>
        <div className="deck-info">
          📚 Pakli: {game.deck.length}
        </div>
      </div>

      <div className="game-status">{game.lastAction}</div>

      {game.gamePhase === 'finished' ? (
        <div className="game-over">
          <h2>{getWinner()}</h2>
          <p>👤 Te: {playerPoints} pont | 🤖 Gép: {aiPoints} pont</p>
          <button className="btn-primary" onClick={resetGame}>
            🔄 Új játék
          </button>
        </div>
      ) : (
        <>
          {/* AI hand (face down) */}
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
            <div className="pile-label">Asztal ({game.pile.length} lap)</div>
            <div className="pile">
              {game.pile.length === 0 ? (
                <div className="empty-pile">Üres</div>
              ) : (
                game.pile.map((card, i) => (
                  <div key={card.id} className="pile-card" style={{ marginLeft: i * 20 }}>
                    {renderCard(card)}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player hand */}
          <div className="player-hand">
            <div className="hand-label">👤 Te ({game.playerHand.length} lap)</div>
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
            <span>👤 Bevitt: {game.playerWon.length} lap</span>
            <span>🤖 Bevitt: {game.aiWon.length} lap</span>
          </div>
        </>
      )}
    </div>
  )
}
