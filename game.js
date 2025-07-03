const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElem = document.getElementById('score');
const messageElem = document.getElementById('message');

// Load images
const birdImg = new Image();
birdImg.src = 'face.png';
const pipeImg = new Image();
pipeImg.src = 'reign_can.png';

// Game constants
const WIDTH = 400;
const HEIGHT = 600;
const GROUND_HEIGHT = 80;
const BIRD_SIZE = 80;
const GRAVITY = 0.5;
const FLAP_STRENGTH = -8;
const PIPE_WIDTH = 100;
const PIPE_GAP = 160;
const PIPE_SPEED = 2.5;
const PIPE_INTERVAL = 90; // frames between pipes
const REIGN_CAN_WIDTH = 120; // Fixed width for reign_can.png
const REIGN_CAN_HEIGHT = 160; // Fixed height for reign_can.png
const BIRD_HITBOX_RATIO = 0.6; // Slimmer hitbox for more accurate collision
const PIPE_COLOR = '#ff69b4'; // pink

// Helper function for rectangle-circle collision detection
// rectWidth and rectHeight should match the visual image dimensions (PIPE_WIDTH and REIGN_CAN_DRAW_HEIGHT)
function rectCircleCollide(rectX, rectY, rectWidth, rectHeight, circleX, circleY, circleRadius) {
  // Find the closest point to the circle within the rectangle
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));
  
  // Calculate the distance between the circle's center and this closest point
  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;
  
  // If the distance is less than the circle's radius, an intersection has occurred
  return (distanceX * distanceX + distanceY * distanceY) < (circleRadius * circleRadius);
}

// Cat-themed game over messages
const GAME_OVER_MESSAGES = [
  "You've used up a life!",
  "Paw-sitively purrished.",
  "Fur-midable effort… but not enough.",
  "That was a cat-astrophe!",
  "Game over… fur now.",
  "You're meowt"
];

// Game state
let bird = null;
let score = 0;
let highScore = 0;
let frame = 0;
let gameState = 'start';

// Add scroll offsets for clouds and ground
let cloudOffset = 0;
let groundOffset = 0;
const CLOUD_SPEED = 0.3;
const GROUND_SPEED = PIPE_SPEED;

// --- PIPE STATE ---
let pipes = [];

function submitScore(name, score) {
  fetch("https://script.google.com/macros/s/AKfycbxNod3WZeFjU-7Qc8NArmhWZkrf9qAmS5J9fubDJRA7qO1hYRGxd2rU49_kfYuswVkz5Q/exec", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `name=${encodeURIComponent(name)}&score=${encodeURIComponent(score)}`
  })
  .then(response => response.text())
  .then(data => console.log("Score submitted:", data))
  .catch(error => console.error("Error submitting score:", error));
}

function resetGame() {
  bird = {
    x: 80,
    y: HEIGHT / 2,
    vy: 0,
    size: BIRD_SIZE
  };
  score = 0;
  frame = 0;
  pipes = [];
  spawnPipe();
}

function drawBackground() {
  // Pixel sky
  ctx.fillStyle = '#6ec6f7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Scrolling pixel clouds
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  const cloudPatterns = [
    {w: 60, h: 20, y: 80},
    {w: 40, h: 16, y: 50},
    {w: 60, h: 20, y: 120}
  ];
  for (let i = 0; i < 3; i++) {
    let x = (60 + i * 120 - cloudOffset) % (WIDTH + 120);
    if (x < -cloudPatterns[i % cloudPatterns.length].w) x += WIDTH + 120;
    ctx.fillRect(x, cloudPatterns[i % cloudPatterns.length].y, cloudPatterns[i % cloudPatterns.length].w, cloudPatterns[i % cloudPatterns.length].h);
  }
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // Scrolling pixel ground
  ctx.save();
  let groundTileWidth = 40;
  let groundTiles = Math.ceil(WIDTH / groundTileWidth) + 2;
  for (let i = 0; i < groundTiles; i++) {
    let x = (i * groundTileWidth - groundOffset) % (WIDTH + groundTileWidth);
    if (x < -groundTileWidth) x += WIDTH + groundTileWidth;
    // Ground base
    ctx.fillStyle = '#b97a56';
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, groundTileWidth, GROUND_HEIGHT);
    // Grass
    ctx.fillStyle = '#6ab150';
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, groundTileWidth, 8);
    // Dirt
    ctx.fillStyle = '#8d5a36';
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT + 16, groundTileWidth, 8);
  }
  ctx.restore();
}

function drawBird() {
  if (!bird) return;
  if (birdImg.complete && birdImg.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(
      birdImg,
      bird.x - bird.size / 2,
      bird.y - bird.size / 2,
      bird.size,
      bird.size
    );
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.strokeStyle = '#bfa600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawPixelSky() {
  // Draw sky gradient (pixelated)
  const skyColors = ['#6ec6f7', '#8fd3ff', '#b3e0ff', '#e0f7fa'];
  const bandHeight = Math.floor((HEIGHT - GROUND_HEIGHT) / skyColors.length);
  for (let i = 0; i < skyColors.length; i++) {
    ctx.fillStyle = skyColors[i];
    ctx.fillRect(0, i * bandHeight, WIDTH, bandHeight);
  }
  // Draw pixel clouds
  const clouds = [
    {x: 60, y: 80, w: 60, h: 20},
    {x: 200, y: 50, w: 80, h: 24},
    {x: 300, y: 120, w: 50, h: 18},
    {x: 120, y: 160, w: 70, h: 22}
  ];
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  clouds.forEach(cloud => {
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cloud.x + i * 12, cloud.y, 12, cloud.h);
    }
  });
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function drawPixelGround() {
  // Draw ground base
  ctx.fillStyle = '#b97a56';
  ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
  // Draw pixel grass
  ctx.fillStyle = '#6ab150';
  for (let x = 0; x < WIDTH; x += 8) {
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, 8, 8);
  }
  // Draw pixel dirt
  ctx.fillStyle = '#8d5a36';
  for (let x = 0; x < WIDTH; x += 8) {
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT + 16, 8, 8);
  }
}

function drawPixelOverlayBorder() {
  // Draw a pixel art border around the overlay
  const border = 8;
  overlay.style.border = `${border}px solid #222`;
  overlay.style.boxShadow = '0 0 0 4px #fff, 0 0 0 8px #222';
  overlay.style.borderRadius = '0';
  overlay.style.background = 'rgba(0,0,0,0.7)';
}

function clearPixelOverlayBorder() {
  overlay.style.border = '';
  overlay.style.boxShadow = '';
  overlay.style.borderRadius = '';
  overlay.style.background = 'rgba(0,0,0,0.5)';
}

function drawScore() {
  ctx.save();
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(score, WIDTH / 2, 80);
  ctx.restore();
}

function update() {
  if (gameState !== 'playing') return;
  frame++;
  // Animate background
  cloudOffset += CLOUD_SPEED;
  if (cloudOffset > WIDTH + 120) cloudOffset = 0;
  groundOffset += GROUND_SPEED;
  if (groundOffset > 40) groundOffset = 0;
  // Bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;

  // Ground or ceiling
  if (bird.y + (bird.size / 2) * BIRD_HITBOX_RATIO > HEIGHT - GROUND_HEIGHT || bird.y - (bird.size / 2) * BIRD_HITBOX_RATIO < 0) {
    gameOver();
  }

  // Pipes
  if (frame % PIPE_INTERVAL === 0) {
    spawnPipe();
  }
  pipes.forEach(pipe => {
    pipe.x -= PIPE_SPEED;
  });
  // Remove off-screen pipes and increment score
  if (pipes.length && pipes[0].x + PIPE_WIDTH < 0) {
    pipes.shift();
    score++;
    scoreElem.textContent = score;
    if (score > (highScore || 0)) highScore = score;
  }

  // --- PIPE COLLISION ---
  const hitboxRadius = (bird.size / 2) * BIRD_HITBOX_RATIO;
  pipes.forEach(pipe => {
    // Top pipe collision
    if (rectCircleCollide(pipe.x, 0, PIPE_WIDTH, pipe.gapY, bird.x, bird.y, hitboxRadius)) {
      gameOver();
      return;
    }
    // Bottom pipe collision
    const bottomY = pipe.gapY + PIPE_GAP;
    const bottomHeight = HEIGHT - GROUND_HEIGHT - bottomY;
    if (rectCircleCollide(pipe.x, bottomY, PIPE_WIDTH, bottomHeight, bird.x, bird.y, hitboxRadius)) {
      gameOver();
      return;
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawPixelGround();
  drawBird();
  drawScore();
  drawPipes();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function flap() {
  if (gameState === 'playing') {
    bird.vy = FLAP_STRENGTH;
  } else if (gameState === 'start' || gameState === 'gameover') {
    startGame();
  }
}

function startGame() {
  // Remove high scores box if present
  const prev = document.getElementById('highScoresDiv');
  if (prev) prev.remove();
  resetGame();
  gameState = 'playing';
  messageElem.style.display = 'none';
  scoreElem.textContent = '0';
}

function fetchHighScoresAndDisplay() {
  if (gameState !== 'gameover') return;
  // Remove any previous high scores display
  const prev = document.getElementById("highScoresDiv");
  if (prev) prev.remove();
  fetch("https://script.google.com/macros/s/AKfycbxNod3WZeFjU-7Qc8NArmhWZkrf9qAmS5J9fubDJRA7qO1hYRGxd2rU49_kfYuswVkz5Q/exec")
    .then(response => response.json())
    .then(data => {
      // Only display if still game over
      if (gameState !== 'gameover') return;
      // Format top 5 scores
      let display = "🏆 High Scores:\n";
      data.slice(0, 5).forEach((row, index) => {
        display += `${index + 1}. ${row[0]} - ${row[1]}\n`;
      });
      // Display below the existing game over message
      const highScoresDiv = document.createElement("div");
      highScoresDiv.id = "highScoresDiv";
      highScoresDiv.style.position = "absolute";
      highScoresDiv.style.top = "65%";
      highScoresDiv.style.left = "50%";
      highScoresDiv.style.transform = "translate(-50%, 0)";
      highScoresDiv.style.color = "white";
      highScoresDiv.style.font = "bold 16px monospace";
      highScoresDiv.style.textAlign = "center";
      highScoresDiv.style.textShadow = "2px 2px black";
      highScoresDiv.innerText = display;
      document.body.appendChild(highScoresDiv);
    })
    .catch(error => {
      console.error("Error fetching high scores:", error);
    });
}

function gameOver() {
  gameState = 'gameover';
  const randomMessage = GAME_OVER_MESSAGES[Math.floor(Math.random() * GAME_OVER_MESSAGES.length)];
  messageElem.innerHTML = `<div style='font-size:2em;font-weight:bold;'>${randomMessage}</div><div style='font-size:1em;margin-top:1em;'>Press Space, Enter, or Tap to Restart</div>`;
  messageElem.style.display = 'block';
  // Prompt for initials and submit score if score > 0
  if (score > 0) {
    const playerName = prompt("Game Over! Enter your initials (3 letters):");
    if (playerName) {
      submitScore(playerName.substring(0, 3).toUpperCase(), score);
    }
  }
  fetchHighScoresAndDisplay();
}

function showStartScreen() {
  messageElem.innerHTML = `<div style='font-size:2em;font-weight:bold;'>Flappy Snickers</div><div style='font-size:1em;margin-top:1em;'>Press Space, Enter, or Tap to Start</div>`;
  messageElem.style.display = 'block';
  scoreElem.textContent = '0';
}

// --- PIPE FUNCTIONS ---
function spawnPipe() {
  const minGapY = 60;
  const maxGapY = HEIGHT - PIPE_GAP - GROUND_HEIGHT - 60;
  const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
  pipes.push({
    x: WIDTH,
    gapY: gapY
  });
}

function drawPipes() {
  const TILE_HEIGHT = 230; // Even taller visible size
  const TILE_WIDTH = PIPE_WIDTH;

  pipes.forEach(pipe => {
    const bottomY = pipe.gapY + PIPE_GAP;
    const bottomLimit = HEIGHT - GROUND_HEIGHT;

    // --- Draw Top Pipe (flipped Churu images going up)
    if (pipeImg.complete) {
      for (
        let y = pipe.gapY - TILE_HEIGHT;
        y >= -TILE_HEIGHT;
        y -= TILE_HEIGHT
      ) {
        ctx.save();
        ctx.translate(pipe.x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
        ctx.scale(1, -1); // Flip vertically
        ctx.drawImage(pipeImg, -TILE_WIDTH / 2, -TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT);
        ctx.restore();
      }
    }

    // --- Draw Bottom Pipe (normal Churu images going down)
    if (pipeImg.complete) {
      for (
        let y = bottomY;
        y <= bottomLimit;
        y += TILE_HEIGHT
      ) {
        ctx.drawImage(pipeImg, pipe.x, y, TILE_WIDTH, TILE_HEIGHT);
      }
    }
  });
}

// Controls
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    flap();
  }
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  flap();
});
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  flap();
});

// Set up canvas size
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.focus();

// Start
showStartScreen();
loop();

// Remove responsive canvas resizing
canvas.width = 400;
canvas.height = 600; 