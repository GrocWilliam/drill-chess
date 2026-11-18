export type EndgameGoal = 'win' | 'draw';

export type EndgamePosition = { id: string; level: 1 | 2 | 3 | 4; goal: EndgameGoal; fen: string };

export const POSITIONS: EndgamePosition[] = [
  { id: 'kq-k', level: 1, goal: 'win', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1' },
  { id: 'kr-k', level: 1, goal: 'win', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1' },
  { id: 'krr-k', level: 1, goal: 'win', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1' },
  { id: 'kbb-k', level: 1, goal: 'win', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1' },
  { id: 'kp-opposition', level: 2, goal: 'win', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1' },
  { id: 'kp-key-squares', level: 2, goal: 'win', fen: '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1' },
  { id: 'kp-king-ahead', level: 2, goal: 'win', fen: '8/8/8/3k4/8/8/3PK3/8 w - - 0 1' },
  { id: 'kp-defence', level: 2, goal: 'draw', fen: '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1' },
  { id: 'kp-defence-2', level: 2, goal: 'draw', fen: '8/8/4k3/8/4PK2/8/8/8 b - - 0 1' },
  { id: 'square-rule', level: 2, goal: 'draw', fen: '8/8/8/P7/4k3/8/8/7K b - - 0 1' },
  { id: 'rook-pawn', level: 2, goal: 'draw', fen: '8/k7/8/K7/P7/8/8/8 b - - 0 1' },
  { id: 'lucena', level: 3, goal: 'win', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1' },
  { id: 'philidor', level: 3, goal: 'draw', fen: '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1' },
  { id: 'philidor-early', level: 3, goal: 'draw', fen: '4k3/8/r7/8/4P3/4K3/8/7R b - - 0 1' },
  { id: 'vancura', level: 3, goal: 'draw', fen: 'R7/6k1/P4r2/8/8/8/8/K7 b - - 0 1' },
  { id: 'kq-kr', level: 4, goal: 'win', fen: '8/8/8/8/8/3k4/2r5/K6Q w - - 0 1' },
  { id: 'kbn-k', level: 4, goal: 'win', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1' },
  { id: 'kr-kb', level: 4, goal: 'draw', fen: '8/8/8/4k3/8/3b4/8/R3K3 b - - 0 1' },
  { id: 'kr-kn', level: 4, goal: 'draw', fen: '8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1' },
  { id: 'kq-kp7', level: 4, goal: 'draw', fen: '8/8/8/8/8/1K6/2pk4/7Q b - - 0 1' },
];
