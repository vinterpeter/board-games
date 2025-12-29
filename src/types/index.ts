export type GameCategory = 'board' | 'card' | 'strategy' | 'party';

export interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
  category: GameCategory;
}

export interface Room {
  id: string;
  gameId: string;
  hostName: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  gameState: any;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export interface TicTacToeState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  isDraw: boolean;
}
