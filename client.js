let ws;
let roomId;
let playerName;
let isRep = false;

function $(id) { return document.getElementById(id); }

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function joinRoom() {
  playerName = $('playerName').value.trim();
  roomId = $('roomId').value.trim();

  if (!playerName) return alert("Enter a name");

  ws = new WebSocket(`wss://${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'joinRoom',
      name: playerName,
      roomId: roomId || null
    }));
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === 'roomJoined') {
      roomId = data.roomId;
      $('roomIdDisplay').innerText = roomId;
      switchScreen('roomScreen');
    }

    if (data.type === 'stateUpdate') {
      renderRoom(data.room);
      renderGame(data.room);
    }

    if (data.type === 'marketPeek') {
      console.log("Market Peek:", data.stocks);
      alert("Market Peek activated! Check console.");
    }
  };
}

function renderRoom(room) {
  const list = $('playersList');
  list.innerHTML = '';

  Object.values(room.players).forEach(p => {
    const div = document.createElement('div');
    div.className = 'team-card';
    div.innerText = `${p.name} ${p.isRep ? '(Rep)' : ''}`;
    list.appendChild(div);
  });

  const me = Object.values(room.players).find(p => p.name === playerName);
  isRep = me?.isRep;

  if (isRep) $('startBtn').style.display = 'block';
}

function startGame() {
  ws.send(JSON.stringify({ type: 'startGame' }));
  switchScreen('gameScreen');
}

function renderGame(room) {
  renderStocks(room);
  renderShop(room);
  renderTeam(room);
}

function renderStocks(room) {
  const list = $('stocksList');
  list.innerHTML = '';

  Object.keys(room.stocks).forEach(stock => {
    const s = room.stocks[stock];
    const div = document.createElement('div');
    div.className = 'team-card';
    div.innerHTML = `
      <strong>${stock}</strong><br>
      Value: ${s.value}<br>
      You own: ${room.players[room.selfId]?.stocks?.[stock] || 0}<br>
      ${isRep ? `
        <button onclick="buyStock('${stock}')">Buy</button>
        <button onclick="sellStock('${stock}')">Sell</button>
      ` : ''}
    `;
    list.appendChild(div);
  });
}

function buyStock(stock) {
  ws.send(JSON.stringify({ type: 'buyStock', stock }));
}

function sellStock(stock) {
  ws.send(JSON.stringify({ type: 'sellStock', stock }));
}

function renderShop(room) {
  const list = $('shopList');
  list.innerHTML = '';

  const powerUps = [
    { id: 'TEAM_BOOST', name: 'Team Boost', cost: 5 },
    { id: 'STOCK_FREEZE', name: 'Stock Freeze', cost: 5 },
    { id: 'STOCK_SHIELD', name: 'Stock Shield', cost: 5 },
    { id: 'MARKET_PEEK', name: 'Market Peek', cost: 3 },
    { id: 'TIME_BUBBLE', name: 'Time Bubble', cost: 3 },
    { id: 'TEAM_RALLY', name: 'Team Rally', cost: 4 },
    { id: 'ACCURACY_LOCK', name: 'Accuracy Lock', cost: 4 }
  ];

  powerUps.forEach(p => {
    const div = document.createElement('div');
    div.className = 'team-card';
    div.innerHTML = `
      <strong>${p.name}</strong><br>
      Cost: ${p.cost}<br>
      ${isRep ? `<button onclick="buyPowerUp('${p.id}')">Buy</button>` : ''}
    `;
    list.appendChild(div);
  });
}

function buyPowerUp(id) {
  ws.send(JSON.stringify({ type: 'buyPowerUp', powerUp: id }));
}

function renderTeam(room) {
  const me = room.players[room.selfId];
  if (!me) return;

  $('teamInfo').innerHTML = `
    <div class="team-card">
      <strong>Team:</strong> ${me.team}<br>
      <strong>Points:</strong> ${room.teams[me.team].points}<br>
      <strong>Coins:</strong> ${room.teams[me.team].coins}<br>
    </div>
  `;
}
