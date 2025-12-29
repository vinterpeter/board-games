// Hungarian Card Deck - Magyar Kártya
export type Suit = 'makk' | 'zold' | 'tok' | 'piros'
export type Rank = '7' | '8' | '9' | '10' | 'also' | 'felso' | 'kiraly' | 'asz'

export interface Card {
  suit: Suit
  rank: Rank
  id: string
}

export const SUITS: Suit[] = ['piros', 'tok', 'zold', 'makk']
export const RANKS: Rank[] = ['7', '8', '9', '10', 'also', 'felso', 'kiraly', 'asz']

// Snapszer uses only 20 cards (no 7, 8)
export const SNAPSZER_RANKS: Rank[] = ['9', '10', 'also', 'felso', 'kiraly', 'asz']

export const SUIT_SYMBOLS: Record<Suit, string> = {
  makk: '🌰',
  zold: '🌿',
  tok: '🔔',
  piros: '❤️'
}

export const SUIT_NAMES: Record<Suit, string> = {
  makk: 'Makk',
  zold: 'Zöld',
  tok: 'Tök',
  piros: 'Piros'
}

export const RANK_NAMES: Record<Rank, string> = {
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'also': 'Alsó',
  'felso': 'Felső',
  'kiraly': 'Király',
  'asz': 'Ász'
}

export const RANK_SYMBOLS: Record<Rank, string> = {
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'also': 'A',
  'felso': 'F',
  'kiraly': 'K',
  'asz': 'Á'
}

// Zsírozás point values
export const ZSIROZAS_VALUES: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  'also': 2,
  'felso': 3,
  'kiraly': 4,
  'asz': 11
}

// Snapszer point values
export const SNAPSZER_VALUES: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  'also': 2,
  'felso': 3,
  'kiraly': 4,
  'asz': 11
}

// Snapszer card strength for trick-taking
export const SNAPSZER_STRENGTH: Record<Rank, number> = {
  '7': 0,
  '8': 1,
  '9': 2,
  'also': 3,
  'felso': 4,
  'kiraly': 5,
  '10': 6,
  'asz': 7
}

export const createDeck = (ranks: Rank[] = RANKS): Card[] => {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${suit}-${rank}` })
    }
  }
  return deck
}

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck]
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
  }
  return newDeck
}

export const getCardDisplay = (card: Card): string => {
  return `${SUIT_SYMBOLS[card.suit]} ${RANK_NAMES[card.rank]}`
}

export const calculateZsirozasPoints = (cards: Card[]): number => {
  return cards.reduce((sum, card) => sum + ZSIROZAS_VALUES[card.rank], 0)
}

export const calculateSnapszerPoints = (cards: Card[]): number => {
  return cards.reduce((sum, card) => sum + SNAPSZER_VALUES[card.rank], 0)
}
