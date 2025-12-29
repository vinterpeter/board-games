import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface PlayerNameContextType {
  playerName: string
  setPlayerName: (name: string) => void
  isCustomName: boolean
  resetToDefault: () => void
}

const PlayerNameContext = createContext<PlayerNameContextType | null>(null)

const STORAGE_KEY = 'customPlayerName'

export function PlayerNameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [customName, setCustomName] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  // Sync custom name to localStorage
  useEffect(() => {
    if (customName) {
      localStorage.setItem(STORAGE_KEY, customName)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [customName])

  const playerName = customName || user?.displayName || 'Vendég'
  const isCustomName = !!customName

  const setPlayerName = (name: string) => {
    const trimmed = name.trim()
    if (trimmed) {
      setCustomName(trimmed)
    }
  }

  const resetToDefault = () => {
    setCustomName(null)
  }

  return (
    <PlayerNameContext.Provider value={{ playerName, setPlayerName, isCustomName, resetToDefault }}>
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
