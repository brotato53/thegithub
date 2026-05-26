import express from 'express';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Serve index.html for root
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Triangle Stock Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0f0f1e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .screen { display: none; }
    .screen.active { display: block; }
    h1 { text-align: center; margin-bottom: 30px; color: #00d4ff; }
    h2 { margin-bottom: 20px; color: #00d4ff; }
    .input-group { margin-bottom: 15px; }
    input, button { padding: 10px 15px; border: none; border-radius: 5px; font-size: 14px; }
    input { background: #2a2a3e; color: #e0e0e0; border: 1px solid #00d4ff; }
    button {
      background: #00d4ff;
      color: #000;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
    }
    button:hover { background: #00a8cc; transform: scale(1.05); }
    button:disabled { background: #666; cursor: not-allowed; transform: none; }
    .team-card {
      background: linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%);
      border: 2px solid #00d4ff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      color: #e0e0e0;
    }
    .team-card strong { color: #00d4ff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
    .tab-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab-btn {
      padding: 8px 15px;
      background: #2a2a3e;
      border: 2px solid #00d4ff;
      color: #00d4ff;
      cursor: pointer;
      border-radius: 5px;
      transition: all 0.3s;
    }
    .tab-btn.active { background: #00d4ff; color: #000; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .podium { text-align: center; }
    .podium-item { margin: 20px 0; font-size: 18px; }
    .podium-item.gold { color: #ffd700; }
    .podium-item.silver { color: #c0c0c0; }
    .podium-item.bronze { color: #cd7f32; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Lobby Screen -->
    <div id="lobbyScreen" class="screen active">
      <h1>Triangle Stock Game</h1>
      <div class="input-group">
        <input type="text" id="playerName" placeholder="Enter your name">
      </div>
      <div class="input-group">
        <input type="text" id="roomId" placeholder="Enter room ID (or leave blank for new)">
      </div>
      <button onclick="joinRoom()">Join Game</button>
    </div>

    <!-- Room Screen -->
    <div id="roomScreen" class="screen">
      <h1>Room: <span id="roomIdDisplay"></span></h1>
      <h2>Players</h2>
      <div id="playersList"></div>
      <button id="startBtn" onclick="startGame()" style="display:none;">Start Game</button>
    </div>

    <!-- Game Screen -->
    <div id="gameScreen" class="screen">
      <h1>Round <span id="roundNum"></span>/30</h1>
      <div id="questionSection">
        <h2 id="questionText"></h2>
        <p id="repNotice"></p>
        <div id="answerInput" style="display:none;">
          <input type="text" id="answerField" placeholder="Enter answer">
          <button onclick="submitAnswer()">Submit</button>
        </div>
      </div>
      <div class="tab-buttons">
        <button class="tab-btn active" onclick="switchTab('stocks')">Stocks</button>
        <button class="tab-btn" onclick="switchTab('shop')">Shop</button>
      </div>
      <div id="stocks" class="tab-content active"></div>
      <div id="shop" class="tab-content"></div>
      <button id="nextRoundBtn" onclick="nextRound()" style="display:none;">Next Round</button>
    </div>

    <!-- Podium Screen -->
    <div id="podiumScreen" class="screen">
      <h1>Final Standings</h1>
      <div id="podiumList"></div>
    </div>
  </div>

  <script>
    const ws = new WebSocket(\`ws://\${window.location.host}\`);
    let playerId, playerName, roomId, isRep = false, currentTeam = null;

    ws.onopen = () => console.log('Connected');
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'stateUpdate') {
        updateGameState(msg.room);
        if (msg.standings) showPodium(msg.standings);
      }
      if (msg.type === 'marketPeek') {
        alert('Market Peek: ' + JSON.stringify(msg.stocks));
      }
    };

    function joinRoom() {
      playerName = document.getElementById('playerName').value;
      roomId = document.getElementById('roomId').value || uuidv4();
      if (!playerName) return alert('Enter a name');
      ws.send(JSON.stringify({ type: 'joinRoom', roomId, playerName }));
      document.getElementById('lobbyScreen').classList.remove('active');
      document.getElementById('roomScreen').classList.add('active');
      document.getElementById('roomIdDisplay').textContent = roomId;
    }

    function startGame() {
      ws.send(JSON.stringify({ type: 'startGame' }));
    }

    function updateGameState(room) {
      const player = room.players.find(p => p.name === playerName);
      if (player) {
        isRep = player.isRep;
        currentTeam = player.team;
      }
      document.getElementById('playersList').innerHTML = room.players
        .map(p => \`<div class="team-card">\${p.name} - Team: \${p.team} \${p.isRep ? '(Rep)' : ''}</div>\`).join('');
      const hostBtn = document.getElementById('startBtn');
      if (hostBtn) hostBtn.style.display = room.state.phase === 'lobby' ? 'block' : 'none';

      if (room.state.phase === 'lobby') {
        document.getElementById('roomScreen').classList.add('active');
        document.getElementById('gameScreen').classList.remove('active');
      } else {
        document.getElementById('roomScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        document.getElementById('roundNum').textContent = room.state.round;
        if (room.state.currentQuestion) {
          document.getElementById('questionText').textContent = room.state.currentQuestion.text;
          document.getElementById('repNotice').textContent = isRep ? 'You are the rep - answer the question!' : 'Waiting for rep...';
          document.getElementById('answerInput').style.display = isRep ? 'block' : 'none';
        }
        renderStocks(room.stocks);
        renderShop();
        const nextBtn = document.getElementById('nextRoundBtn');
        if (nextBtn) nextBtn.style.display = room.state.phase === 'buy' ? 'block' : 'none';
      }
    }

    function renderStocks(stocks) {
      const html = Object.keys(stocks).map(stock => \`
        <div class="team-card">
          <strong>\${stock}</strong><br/>
          Value: \${stocks[stock].value}<br/>
          <button onclick="buyStock('\${stock}')" \${!isRep ? 'disabled' : ''}>Buy 1</button>
          <button onclick="sellStock('\${stock}')" \${!isRep ? 'disabled' : ''}>Sell 1</button>
        </div>
      \`).join('');
      document.getElementById('stocks').innerHTML = html;
    }

    function renderShop() {
      const powerUps = [
        { id: 'TEAM_BOOST', name: 'Team Boost', cost: 5, desc: '+20% points for 3 rounds' },
        { id: 'STOCK_FREEZE', name: 'Stock Freeze', cost: 5, desc: 'Freeze one stock for 3 rounds' },
        { id: 'STOCK_SHIELD', name: 'Stock Shield', cost: 5, desc: 'Prevent stock drops for 3 rounds' },
        { id: 'MARKET_PEEK', name: 'Market Peek', cost: 3, desc: 'See upcoming stock values' },
        { id: 'TIME_BUBBLE', name: 'Time Bubble', cost: 3, desc: '+20s to Buy Phase' },
        { id: 'TEAM_RALLY', name: 'Team Rally', cost: 4, desc: '+50 bonus on next answer' },
        { id: 'ACCURACY_LOCK', name: 'Accuracy Lock', cost: 4, desc: 'Next wrong becomes correct' }
      ];
      const html = powerUps.map(p => \`
        <div class="team-card">
          <strong>\${p.name}</strong> - \${p.cost} coins<br/>
          <small>\${p.desc}</small><br/>
          <button onclick="buyPowerUp('\${p.id}')" \${!isRep ? 'disabled' : ''}>Buy</button>
        </div>
      \`).join('');
      document.getElementById('shop').innerHTML = html;
    }

    function buyStock(stock) {
      ws.send(JSON.stringify({ type: 'buyStock', stock }));
    }

    function sellStock(stock) {
      ws.send(JSON.stringify({ type: 'sellStock', stock }));
    }

    function buyPowerUp(powerUp) {
      ws.send(JSON.stringify({ type: 'buyPowerUp', powerUp }));
    }

    function submitAnswer() {
      const answer = document.getElementById('answerField').value;
      ws.send(JSON.stringify({ type: 'submitAnswer', answer }));
      document.getElementById('answerField').value = '';
    }

    function nextRound() {
      ws.send(JSON.stringify({ type: 'nextRound' }));
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tab).classList.add('active');
      event.target.classList.add('active');
    }

    function showPodium(standings) {
      document.getElementById('gameScreen').classList.remove('active');
      document.getElementById('podiumScreen').classList.add('active');
      const html = standings.map((t, i) => {
        const classes = ['gold', 'silver', 'bronze'][i] || '';
        return \`<div class="podium-item \${classes}">#\${t.rank} \${t.name}: \${t.points} points</div>\`;
      }).join('');
      document.getElementById('podiumList').innerHTML = html;
    }

  
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  </script>
</body>
</html>`);
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

// Game state
const rooms = {};
const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink'];
const STOCKS = {
  '345R': { value: 100 },
  'HLL': { value: 125 },
  'RIGHT': { value: 170 },
  'ANGL': { value: 225 }
};

const QUESTIONS = [
  { id: 1, text: 'Is a triangle with sides 3, 4, 5 a right triangle?', answer: 'YES' },
  { id: 2, text: 'Is a triangle with sides 5, 12, 13 a right triangle?', answer: 'YES' },
  { id: 3, text: 'Is a triangle with sides 8, 15, 17 a right triangle?', answer: 'YES' },
  { id: 4, text: 'Is a triangle with sides 7, 24, 25 a right triangle?', answer: 'YES' },
  { id: 5, text: 'Is a triangle with sides 20, 21, 29 a right triangle?', answer: 'YES' },
  { id: 6, text: 'Is a triangle with sides 2, 3, 4 a right triangle?', answer: 'NO' },
  { id: 7, text: 'Is a triangle with sides 4, 5, 6 a right triangle?', answer: 'NO' },
  { id: 8, text: 'Is a triangle with sides 6, 8, 9 a right triangle?', answer: 'NO' },
  { id: 9, text: 'Is a triangle with sides 10, 11, 12 a right triangle?', answer: 'NO' },
  { id: 10, text: 'Is a triangle with sides 1, 2, 3 a right triangle?', answer: 'NO' },
  { id: 11, text: 'Is a triangle with sides 9, 40, 41 a right triangle?', answer: 'YES' },
  { id: 12, text: 'Is a triangle with sides 11, 60, 61 a right triangle?', answer: 'YES' },
  { id: 13, text: 'Is a triangle with sides 13, 84, 85 a right triangle?', answer: 'YES' },
  { id: 14, text: 'Is a triangle with sides 3, 5, 7 a right triangle?', answer: 'NO' },
  { id: 15, text: 'Is a triangle with sides 6, 10, 12 a right triangle?', answer: 'NO' },
  { id: 16, text: 'A right triangle has legs 3 and 4. What is the hypotenuse?', answer: '5' },
  { id: 17, text: 'A right triangle has legs 5 and 12. What is the hypotenuse?', answer: '13' },
  { id: 18, text: 'A right triangle has legs 8 and 15. What is the hypotenuse?', answer: '17' },
  { id: 19, text: 'A right triangle has legs 7 and 24. What is the hypotenuse?', answer: '25' },
  { id: 20, text: 'A right triangle has legs 20 and 21. What is the hypotenuse?', answer: '29' },
  { id: 21, text: 'A right triangle has a leg of 6 and hypotenuse of 10. What is the other leg?', answer: '8' },
  { id: 22, text: 'A right triangle has a leg of 5 and hypotenuse of 13. What is the other leg?', answer: '12' },
  { id: 23, text: 'A right triangle has a leg of 9 and hypotenuse of 15. What is the other leg?', answer: '12' },
  { id: 24, text: 'A right triangle has a leg of 8 and hypotenuse of 17. What is the other leg?', answer: '15' },
  { id: 25, text: 'A right triangle has a leg of 12 and hypotenuse of 20. What is the other leg?', answer: '16' },
  { id: 26, text: 'A right triangle has legs 9 and 40. What is the hypotenuse?', answer: '41' },
  { id: 27, text: 'A right triangle has legs 11 and 60. What is the hypotenuse?', answer: '61' },
  { id: 28, text: 'A right triangle has legs 13 and 84. What is the hypotenuse?', answer: '85' },
  { id: 29, text: 'A right triangle has a leg of 15 and hypotenuse of 25. What is the other leg?', answer: '20' },
  { id: 30, text: 'A right triangle has a leg of 7 and hypotenuse of 25. What is the other leg?', answer: '24' }
];

function initTeams(room) {
  room.teams = {};
  TEAM_NAMES.forEach(name => {
    room.teams[name] = {
      name,
      repId: null,
      points: 0,
      coins: 0,
      stocks: { '345R': 0, 'HLL': 0, 'RIGHT': 0, 'ANGL': 0 },
      powerUps: {
        teamBoostRounds: 0,
        stockFreezeRounds: 0,
        stockFreezeTarget: null,
        stockShieldRounds: 0,
        marketPeekActive: false,
        timeBubbleActive: false,
        teamRallyNext: false,
        accuracyLockNext: false
      }
    };
  });
}

function assignTeams(room) {
  const players = Object.values(room.players);
  let teamIndex = 0;
  players.forEach(player => {
    const teamName = TEAM_NAMES[teamIndex % TEAM_NAMES.length];
    player.team = teamName;
    if (!room.teams[teamName].repId) {
      player.isRep = true;
      room.teams[teamName].repId = player.id;
    } else {
      player.isRep = false;
    }
    teamIndex++;
  });
}

function applyStockMovement(room) {
  for (const stockName in STOCKS) {
    const stock = STOCKS[stockName];
    const frozen = Object.values(room.teams).some(t =>
      t.powerUps.stockFreezeTarget === stockName &&
      t.powerUps.stockFreezeRounds > 0
    );
    if (frozen) continue;
    const roll = Math.random();
    let oldValue = stock.value;
    let newValue = stock.value;
    if (stockName === '345R') {
      newValue = roll < 0.70 ? Math.round(stock.value * 1.20) : Math.round(stock.value * 0.70);
    } else if (stockName === 'HLL') {
      newValue = roll < 0.65 ? Math.round(stock.value * 1.30) : Math.round(stock.value * 0.75);
    } else if (stockName === 'RIGHT') {
      newValue = roll < 0.55 ? Math.round(stock.value * 1.35) : Math.round(stock.value * 0.70);
    } else if (stockName === 'ANGL') {
      newValue = roll < 0.45 ? Math.round(stock.value * 1.75) : Math.round(stock.value * 0.50);
    }
    const anyShield = Object.values(room.teams).some(t => t.powerUps.stockShieldRounds > 0);
    if (anyShield && newValue < oldValue) newValue = oldValue;
    stock.value = Math.max(1, newValue);
  }
}

function startNextQuestion(room) {
  if (room.state.round > 30) {
    endGameToPodium(room);
    return;
  }
  const q = QUESTIONS[room.state.round - 1];
  room.state.currentQuestion = q;
  room.state.phase = 'question';
  broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
}

function goToRevealPhase(room) {
  room.state.phase = 'reveal';
  broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
  setTimeout(() => goToBuyPhase(room), 3000);
}

function goToBuyPhase(room) {
  room.state.phase = 'buy';
  room.state.buyTimer = 60;
  const anyTimeBubble = Object.values(room.teams).some(t => t.powerUps.timeBubbleActive);
  if (anyTimeBubble) {
    room.state.buyTimer += 20;
    Object.values(room.teams).forEach(t => t.powerUps.timeBubbleActive = false);
  }
  broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
}

function goToTradePhase(room) {
  room.state.phase = 'trade';
  room.state.tradeTimer = 120;
  broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
}

function endGameToPodium(room) {
  room.state.phase = 'podium';
  const standings = Object.values(room.teams)
    .sort((a, b) => b.points - a.points)
    .map((t, idx) => ({ rank: idx + 1, ...t }));
  broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room), standings });
}

function getPublicRoomState(room) {
  return {
    roomId: room.id,
    state: room.state,
    teams: room.teams,
    stocks: STOCKS,
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, team: p.team, isRep: p.isRep }))
  };
}

function broadcast(room, msg) {
  Object.values(room.players).forEach(p => {
    if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
  });
}

wss.on('connection', (ws) => {
  const playerId = uuidv4();
  let room = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if (msg.type === 'joinRoom') {
      const { roomId, playerName } = msg;
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          hostId: playerId,
          players: {},
          teams: {},
          state: { phase: 'lobby', round: 1, currentQuestion: null, buyTimer: 0, tradeTimer: 0 }
        };
        initTeams(rooms[roomId]);
      }
      room = rooms[roomId];
      room.players[playerId] = { id: playerId, name: playerName, ws, team: null, isRep: false };
      broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
    }

    if (msg.type === 'startGame' && playerId === room.hostId) {
      assignTeams(room);
      room.state.phase = 'question';
      room.state.round = 1;
      startNextQuestion(room);
    }

    if (msg.type === 'submitAnswer') {
      const player = room.players[playerId];
      if (!player || !player.isRep) return;
      if (room.state.phase !== 'question') return;
      const team = room.teams[player.team];
      const q = room.state.currentQuestion;
      let ans = (msg.answer || '').trim().toUpperCase();
      let correct = ans === q.answer.toUpperCase();
      if (!correct && team.powerUps.accuracyLockNext) {
        correct = true;
        team.powerUps.accuracyLockNext = false;
      }
      if (correct) {
        let points = 100;
        if (team.powerUps.teamBoostRounds > 0) points = Math.round(points * 1.2);
        if (team.powerUps.teamRallyNext) {
          points += 50;
          team.powerUps.teamRallyNext = false;
        }
        team.points += points;
        team.coins += 1;
      }
      goToRevealPhase(room);
    }

    if (msg.type === 'buyStock') {
      const player = room.players[playerId];
      if (!player || !player.isRep || room.state.phase !== 'buy') return;
      const team = room.teams[player.team];
      const { stock } = msg;
      const cost = STOCKS[stock].value;
      if (team.points >= cost) {
        team.points -= cost;
        team.stocks[stock]++;
        broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
      }
    }

    if (msg.type === 'sellStock') {
      const player = room.players[playerId];
      if (!player || !player.isRep || room.state.phase !== 'buy') return;
      const team = room.teams[player.team];
      const { stock } = msg;
      if (team.stocks[stock] > 0) {
        const value = Math.round(STOCKS[stock].value * 0.8);
        team.points += value;
        team.stocks[stock]--;
        broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
      }
    }

    if (msg.type === 'buyPowerUp') {
      const player = room.players[playerId];
      if (!player || !player.isRep || room.state.phase !== 'buy') return;
      const team = room.teams[player.team];
      const { powerUp, targetStock } = msg;
      const COSTS = { TEAM_BOOST: 5, STOCK_FREEZE: 5, STOCK_SHIELD: 5, MARKET_PEEK: 3, TIME_BUBBLE: 3, TEAM_RALLY: 4, ACCURACY_LOCK: 4 };
      const cost = COSTS[powerUp];
      if (team.coins < cost) return;
      team.coins -= cost;
      switch (powerUp) {
        case 'TEAM_BOOST':
          team.powerUps.teamBoostRounds = 3;
          break;
        case 'STOCK_FREEZE':
          team.powerUps.stockFreezeRounds = 3;
          team.powerUps.stockFreezeTarget = targetStock || '345R';
          break;
        case 'STOCK_SHIELD':
          team.powerUps.stockShieldRounds = 3;
          break;
        case 'MARKET_PEEK':
          ws.send(JSON.stringify({ type: 'marketPeek', stocks: STOCKS }));
          team.powerUps.marketPeekActive = false;
          break;
        case 'TIME_BUBBLE':
          team.powerUps.timeBubbleActive = true;
          break;
        case 'TEAM_RALLY':
          team.powerUps.teamRallyNext = true;
          break;
        case 'ACCURACY_LOCK':
          team.powerUps.accuracyLockNext = true;
          break;
      }
      broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
    }

    if (msg.type === 'nextRound' && playerId === room.hostId) {
      applyStockMovement(room);
      if (room.state.round === 10 || room.state.round === 20) {
        goToTradePhase(room);
        return;
      }
      if (room.state.round >= 30) {
        endGameToPodium(room);
        return;
      }
      room.state.round++;
      Object.values(room.teams).forEach(t => {
        if (t.powerUps.teamBoostRounds > 0) t.powerUps.teamBoostRounds--;
        if (t.powerUps.stockFreezeRounds > 0) t.powerUps.stockFreezeRounds--;
        if (t.powerUps.stockShieldRounds > 0) t.powerUps.stockShieldRounds--;
      });
      startNextQuestion(room);
    }
  });

  ws.on('close', () => {
    if (room && room.players[playerId]) {
      delete room.players[playerId];
      if (Object.keys(room.players).length === 0) {
        delete rooms[room.id];
      } else {
        broadcast(room, { type: 'stateUpdate', room: getPublicRoomState(room) });
      }
    }
  });
});
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
