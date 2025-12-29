import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameLobby from './pages/GameLobby'
import GameRoom from './pages/GameRoom'
import './App.css'

function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:gameId" element={<GameLobby />} />
          <Route path="/room/:roomId" element={<GameRoom />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

export default App
