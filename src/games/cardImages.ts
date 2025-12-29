// Mapping Hungarian card names to image file names

// Internal suit names to image file suit names
const suitToFile: Record<string, string> = {
  'makk': 'acorn',
  'zold': 'leaf',
  'tok': 'bell',
  'piros': 'heart',
}

// Internal rank names to image file rank names
const rankToFile: Record<string, string> = {
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  'also': 'unter',
  'felso': 'ober',
  'kiraly': 'king',
  'asz': 'ace',
}

// Get the base URL for assets (handles GitHub Pages subdirectory)
const BASE_URL = import.meta.env.BASE_URL || '/'

// Get the image path for a specific card
export function getCardImagePath(suit: string, rank: string): string {
  const suitFile = suitToFile[suit] || suit
  const rankFile = rankToFile[rank] || rank
  return `${BASE_URL}cards/${suitFile}-${rankFile}.png`
}

// Get the back of card image path
export function getCardBackPath(): string {
  return `${BASE_URL}cards/back.png`
}

// Hungarian display names for suits
export const suitNames: Record<string, string> = {
  'makk': 'Makk',
  'zold': 'Zöld',
  'tok': 'Tök',
  'piros': 'Piros',
}

// Hungarian display names for ranks
export const rankNames: Record<string, string> = {
  '7': 'Hetes',
  '8': 'Nyolcas',
  '9': 'Kilences',
  '10': 'Tízes',
  'also': 'Alsó',
  'felso': 'Felső',
  'kiraly': 'Király',
  'asz': 'Ász',
}
