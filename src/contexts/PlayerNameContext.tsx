import { createContext, useContext, type ReactNode } from 'react'

interface PlayerNameContextType {
  playerName: string
}

const PlayerNameContext = createContext<PlayerNameContextType | null>(null)

const PLAYER_NAME = 'Játékos'

export function PlayerNameProvider({ children }: { children: ReactNode }) {
  return (
    <PlayerNameContext.Provider value={{ playerName: PLAYER_NAME }}>
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
