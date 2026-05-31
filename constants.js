export const DIE1 = ['dead-end','corner','straight','cross','t-junction','t-junction'];
export const DIE2 = ['corner','straight','cross','cross','t-junction','t-junction'];

export const BASE_OPENINGS = {
  'dead-end':   ['N'],
  'corner':     ['N','E'],
  'straight':   ['N','S'],
  't-junction': ['N','E','W'],
  'cross':      ['N','E','S','W'],
};

export const DIRS      = ['N','E','S','W'];
export const DIR_INDEX = { N:0, E:1, S:2, W:3 };
export const DIR_RC    = { N:[-1,0], S:[1,0], E:[0,1], W:[0,-1] };

export const PLAYER_COLORS = ['#e94560','#53d8fb','#ffd700','#a855f7','#f97316','#22c55e'];

export const SHEETS = {
  front: {
    rows:5, cols:5, maxRounds:12,
    topEdge:[1,3,1,1,1], bottomEdge:[1,1,3,1,1],
    leftEdge:[1,3,1,1,5], rightEdge:[5,1,1,1,1],
    prePlaced:[
      {r:1,c:1,type:'corner',rot:0},
      {r:4,c:3,type:'corner',rot:2},
    ]
  },
  back: {
    rows:6, cols:5, maxRounds:14,
    topEdge:[5,1,1,1,1], bottomEdge:[1,1,5,1,1],
    leftEdge:[1,1,1,5,1,1], rightEdge:[5,1,1,1,5,1],
    prePlaced:[
      {r:2,c:2,type:'t-junction',rot:1},
    ]
  }
};

export const SOLO_RATINGS = [
  {min:40,max:40,label:'Pipeline-Profi 🏆'},
  {min:37,max:39,label:'Würfel-Champion 🎲'},
  {min:34,max:36,label:'Verbindungsperson 🔧'},
  {min:30,max:33,label:'Leitungslehrling 📐'},
  {min:20,max:29,label:'Kanalreiniger 🪣'},
  {min:0, max:19,label:'Rohrkrepierer 💥'},
];

export const SAVE_KEY = 'pipeline_solo_save';
export const NAME_KEY = 'pipeline_player_name';
