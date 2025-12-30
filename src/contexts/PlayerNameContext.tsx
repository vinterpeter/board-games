import { createContext, useContext, useState, type ReactNode } from 'react'

interface PlayerNameContextType {
  playerName: string
  setPlayerName: (name: string) => void
}

const PlayerNameContext = createContext<PlayerNameContextType | null>(null)

// Fantasy names for random assignment
const FANTASY_NAMES = [
  'Sárkányfogó',
  'Villámkéz',
  'Holdlovag',
  'Csillagpor',
  'Tűzmadár',
  'Éjsólyom',
  'Viharszem',
  'Jégszív',
  'Napfény',
  'Árnyékjáró',
  'Farkasszem',
  'Saskarom',
  'Medvebőr',
  'Rókalélek',
  'Kőszikla',
  'Erdőláb',
  'Vasököl',
  'Aranyhal',
  'Ezüstnyíl',
  'Bronzpajzs',
]

const getRandomFantasyName = () => {
  const index = Math.floor(Math.random() * FANTASY_NAMES.length)
  return FANTASY_NAMES[index]
}

const STORAGE_KEY = 'player_name'

export function PlayerNameProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerNameState] = useState<string>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    // Generate random fantasy name
    const randomName = getRandomFantasyName()
    localStorage.setItem(STORAGE_KEY, randomName)
    return randomName
  })

  const setPlayerName = (name: string) => {
    const finalName = name.trim() || getRandomFantasyName()
    localStorage.setItem(STORAGE_KEY, finalName)
    setPlayerNameState(finalName)
  }

  return (
    <PlayerNameContext.Provider value={{ playerName, setPlayerName }}>
      {children}
    </PlayerNameContext.Provider>
  )
}

export function usePlayerName() {
  const context = useContext(PlayerNameContext)
  if (!context) {
    throw new Error('usePlayerName must be used within a PlayerNameProvider')
  }
  return context
}
