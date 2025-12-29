import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Memory.css'

interface Card {
  id: number
  emoji: string
  isFlipped: boolean
  isMatched: boolean
}

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮']

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

const createCards = (pairCount: number): Card[] => {
  const selectedEmojis = EMOJIS.slice(0, pairCount)
  const pairs = [...selectedEmojis, ...selectedEmojis]
  const shuffled = shuffleArray(pairs)

  return shuffled.map((emoji, index) => ({
    id: index,
    emoji,
    isFlipped: false,
    isMatched: false,
  }))
}

export default function Memory() {
  const { user } = useAuth()
  const playerName = user?.displayName || 'Te'
  const [cards, setCards] = useState<Card[]>(() => createCards(8))
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [difficulty, setDifficulty] = useState<4 | 6 | 8>(8)
  const [vsAI, setVsAI] = useState(false)
  const [currentPlayer, setCurrentPlayer] = useState<'player' | 'ai'>('player')
  const [scores, setScores] = useState({ player: 0, ai: 0 })
  const [aiMemory, setAiMemory] = useState<Map<number, string>>(new Map())
  const [isAITurn, setIsAITurn] = useState(false)

  useEffect(() => {
    if (flippedCards.length === 2) {
      setIsChecking(true)
      const [first, second] = flippedCards

      // AI remembers these cards
      if (vsAI) {
        setAiMemory(prev => {
          const newMemory = new Map(prev)
          newMemory.set(first, cards[first].emoji)
          newMemory.set(second, cards[second].emoji)
          return newMemory
        })
      }

      if (cards[first].emoji === cards[second].emoji) {
        // Match found
        setTimeout(() => {
          setCards(prev =>
            prev.map(card =>
              card.id === first || card.id === second
                ? { ...card, isMatched: true }
                : card
            )
          )
          if (vsAI) {
            setScores(prev => ({
              ...prev,
              [currentPlayer]: prev[currentPlayer] + 1
            }))
          }
          setFlippedCards([])
          setIsChecking(false)
          // Same player continues on match
        }, 500)
      } else {
        // No match - switch players in vs AI mode
        setTimeout(() => {
          setCards(prev =>
            prev.map(card =>
              card.id === first || card.id === second
                ? { ...card, isFlipped: false }
                : card
            )
          )
          setFlippedCards([])
          setIsChecking(false)
          if (vsAI) {
            setCurrentPlayer(prev => prev === 'player' ? 'ai' : 'player')
          }
        }, 1000)
      }
      setMoves(m => m + 1)
    }
  }, [flippedCards, cards, vsAI, currentPlayer])

  useEffect(() => {
    if (cards.length > 0 && cards.every(card => card.isMatched)) {
      setGameWon(true)
    }
  }, [cards])

  // AI turn logic - deliberately weak to be fair and fun
  const makeAIMove = useCallback(() => {
    const unmatched = cards.filter(c => !c.isMatched && !c.isFlipped)
    if (unmatched.length === 0) return

    // AI only remembers cards with 25% probability (very weak memory)
    const knownCards: { id: number; emoji: string }[] = []
    aiMemory.forEach((emoji, id) => {
      const card = cards.find(c => c.id === id)
      if (card && !card.isMatched && Math.random() < 0.25) {
        knownCards.push({ id, emoji })
      }
    })

    // Only 20% chance AI uses memory to find pairs
    const useMemory = Math.random() < 0.2

    if (useMemory) {
      // Find pairs in memory
      for (let i = 0; i < knownCards.length; i++) {
        for (let j = i + 1; j < knownCards.length; j++) {
          if (knownCards[i].emoji === knownCards[j].emoji) {
            const firstId = knownCards[i].id
            const secondId = knownCards[j].id

            setCards(prev => prev.map(c => c.id === firstId ? { ...c, isFlipped: true } : c))
            setFlippedCards([firstId])

            setTimeout(() => {
              setCards(prev => prev.map(c => c.id === secondId ? { ...c, isFlipped: true } : c))
              setFlippedCards([firstId, secondId])
            }, 600)
            return
          }
        }
      }
    }

    // Pick randomly from unmatched cards (AI plays mostly random)
    const firstPick = unmatched[Math.floor(Math.random() * unmatched.length)]
    setCards(prev => prev.map(c => c.id === firstPick.id ? { ...c, isFlipped: true } : c))
    setFlippedCards([firstPick.id])

    setTimeout(() => {
      // Only 15% chance to use memory for second pick
      const firstEmoji = cards.find(c => c.id === firstPick.id)?.emoji
      const matchFromMemory = Math.random() < 0.15
        ? knownCards.find(k => k.emoji === firstEmoji && k.id !== firstPick.id)
        : null

      let secondPick: Card
      if (matchFromMemory) {
        secondPick = cards.find(c => c.id === matchFromMemory.id)!
      } else {
        const remaining = unmatched.filter(c => c.id !== firstPick.id)
        secondPick = remaining[Math.floor(Math.random() * remaining.length)]
      }

      setCards(prev => prev.map(c => c.id === secondPick.id ? { ...c, isFlipped: true } : c))
      setFlippedCards([firstPick.id, secondPick.id])
    }, 600)
  }, [cards, aiMemory])

  useEffect(() => {
    if (vsAI && currentPlayer === 'ai' && !isChecking && !gameWon && !isAITurn) {
      setIsAITurn(true)
      setTimeout(() => {
        makeAIMove()
        setIsAITurn(false)
      }, 800)
    }
  }, [vsAI, currentPlayer, isChecking, gameWon, isAITurn, makeAIMove])

  const handleCardClick = (id: number) => {
    if (isChecking || flippedCards.length >= 2) return
    if (cards[id].isFlipped || cards[id].isMatched) return
    if (vsAI && currentPlayer === 'ai') return

    setCards(prev =>
      prev.map(card =>
        card.id === id ? { ...card, isFlipped: true } : card
      )
    )
    setFlippedCards(prev => [...prev, id])
  }

  const resetGame = (newDifficulty?: 4 | 6 | 8) => {
    const pairs = newDifficulty || difficulty
    if (newDifficulty) setDifficulty(newDifficulty)
    setCards(createCards(pairs))
    setFlippedCards([])
    setMoves(0)
    setIsChecking(false)
    setGameWon(false)
    setCurrentPlayer('player')
    setScores({ player: 0, ai: 0 })
    setAiMemory(new Map())
    setIsAITurn(false)
  }

  const toggleMode = () => {
    setVsAI(!vsAI)
    resetGame()
  }

  const getGridClass = () => {
    if (difficulty === 4) return 'grid-4'
    if (difficulty === 6) return 'grid-6'
    return 'grid-8'
  }

  const getWinMessage = () => {
    if (!vsAI) return { title: '🎉 Gratulálok!', subtitle: `${moves} lépésből sikerült!` }
    if (scores.player > scores.ai) return { title: `🎉 ${playerName} nyertél!`, subtitle: `${scores.player} - ${scores.ai}` }
    if (scores.ai > scores.player) return { title: '🤖 A gép nyert!', subtitle: `${scores.ai} - ${scores.player}` }
    return { title: '🤝 Döntetlen!', subtitle: `${scores.player} - ${scores.ai}` }
  }

  const getTurnMessage = () => {
    if (currentPlayer === 'ai') return '🤖 A gép gondolkodik...'
    return `👤 ${playerName} következel`
  }

  return (
    <div className="memory">
      <div className="mode-toggle">
        <button
          className={!vsAI ? 'active' : ''}
          onClick={() => vsAI && toggleMode()}
        >
          🎮 Egyedül
        </button>
        <button
          className={vsAI ? 'active' : ''}
          onClick={() => !vsAI && toggleMode()}
        >
          🤖 Gép ellen
        </button>
      </div>

      <div className="memory-header">
        {vsAI ? (
          <div className="scores">
            <span className={currentPlayer === 'player' ? 'active' : ''}>👤 {playerName}: {scores.player}</span>
            <span> - </span>
            <span className={currentPlayer === 'ai' ? 'active' : ''}>🤖 {scores.ai}</span>
          </div>
        ) : (
          <div className="moves">🎯 Lépések: {moves}</div>
        )}
        <div className="difficulty-buttons">
          <button
            className={difficulty === 4 ? 'active' : ''}
            onClick={() => resetGame(4)}
          >
            Könnyű
          </button>
          <button
            className={difficulty === 6 ? 'active' : ''}
            onClick={() => resetGame(6)}
          >
            Közepes
          </button>
          <button
            className={difficulty === 8 ? 'active' : ''}
            onClick={() => resetGame(8)}
          >
            Nehéz
          </button>
        </div>
      </div>

      {vsAI && !gameWon && (
        <div className="turn-indicator">{getTurnMessage()}</div>
      )}

      {gameWon ? (
        <div className="win-message">
          <h2>{getWinMessage().title}</h2>
          <p>{getWinMessage().subtitle}</p>
          <button className="btn-primary" onClick={() => resetGame()}>
            🔄 Új játék
          </button>
        </div>
      ) : (
        <div className={`memory-grid ${getGridClass()}`}>
          {cards.map(card => (
            <div
              key={card.id}
              className={`memory-card ${card.isFlipped ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''}`}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="card-inner">
                <div className="card-front">❓</div>
                <div className="card-back">{card.emoji}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
