import { useNavigate } from 'react-router-dom'
import type { Game, GameCategory } from '../types'

const games: Game[] = [
  // Táblajátékok
  {
    id: 'tictactoe',
    name: 'Amőba',
    description: 'Klasszikus 3x3-as amőba játék. Rakj ki 3-at egy sorba!',
    icon: '⭕',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
    category: 'board',
  },
  {
    id: 'connect4',
    name: 'Connect 4',
    description: 'Dobj be 4 korongot egy sorba vízszintesen, függőlegesen vagy átlósan!',
    icon: '🔵',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
    category: 'board',
  },
  {
    id: 'battleship',
    name: 'Torpedó',
    description: 'Süllyeszd el az ellenfél hajóit a klasszikus tengeri csatában!',
    icon: '🚢',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
    category: 'board',
  },
  // Stratégiai játékok
  {
    id: 'chess',
    name: 'Sakk',
    description: 'A stratégiai játékok királya. Tedd matt az ellenfeled!',
    icon: '♟️',
    minPlayers: 2,
    maxPlayers: 2,
    available: false,
    category: 'strategy',
  },
  {
    id: 'checkers',
    name: 'Dáma',
    description: 'Üsd le az ellenfél bábjait és juss át a túloldalra!',
    icon: '🔴',
    minPlayers: 2,
    maxPlayers: 2,
    available: false,
    category: 'strategy',
  },
  // Kártyajátékok
  {
    id: 'zsirozas',
    name: 'Zsírozás',
    description: 'Magyar kártyás játék - gyűjtsd be a legértékesebb lapokat!',
    icon: '🌰',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
    category: 'card',
  },
  {
    id: 'snapszer',
    name: 'Snapszer',
    description: 'Klasszikus magyar kártyajáték - érj el 66 pontot bemondásokkal!',
    icon: '❤️',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
    category: 'card',
  },
  // Parti játékok
  {
    id: 'memory',
    name: 'Memory',
    description: 'Találd meg a párokat! Memória és koncentráció játék.',
    icon: '🃏',
    minPlayers: 1,
    maxPlayers: 4,
    available: true,
    category: 'party',
  },
]

const categoryNames: Record<GameCategory, string> = {
  board: '🎲 Táblajátékok',
  strategy: '♟️ Stratégiai játékok',
  card: '🃏 Kártyajátékok',
  party: '🎉 Parti játékok',
}

const categoryOrder: GameCategory[] = ['board', 'card', 'strategy', 'party']

export default function Home() {
  const navigate = useNavigate()

  const handleGameClick = (game: Game) => {
    if (game.available) {
      navigate(`/lobby/${game.id}`)
    }
  }

  const gamesByCategory = categoryOrder.map(category => ({
    category,
    name: categoryNames[category],
    games: games.filter(g => g.category === category),
  })).filter(group => group.games.length > 0)

  return (
    <div>
      <header className="header">
        <h1>🎲 Társasjáték Platform</h1>
        <p>Válassz egy játékot és játssz barátaiddal online!</p>
      </header>

      <div className="games-container">
        {gamesByCategory.map(group => (
          <div key={group.category} className="game-category">
            <h2 className="category-title">{group.name}</h2>
            <div className="games-list">
              {group.games.map(game => (
                <div
                  key={game.id}
                  className={`game-list-item ${!game.available ? 'coming-soon' : ''}`}
                  onClick={() => handleGameClick(game)}
                >
                  <div className="game-icon">{game.icon}</div>
                  <div className="game-info">
                    <h3>{game.name}</h3>
                    <p>{game.description}</p>
                  </div>
                  <div className="game-meta">
                    <span className="players">👥 {game.minPlayers}-{game.maxPlayers}</span>
                    {!game.available && <span className="status">Hamarosan</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
