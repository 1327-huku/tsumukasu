const { Engine, World, Bodies, Body, Composite } = Matter;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const finalScoreEl = document.getElementById("finalScore");
const startBtn = document.getElementById("startBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

// ゲーム設定
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TSUM_RADIUS = 6;
const TSUM_COUNT = 1800;
const GAME_DURATION = 60;

// 使用する画像ファイルと、画像未設定時の代替カラー
const TSUM_CONFIG = [
  { src: "images/tsum1.png", color: "#ff595e" },
  { src: "images/tsum2.png", color: "#ffca3a" },
  { src: "images/tsum3.png", color: "#8ac926" },
  { src: "images/tsum4.png", color: "#1982c4" },
  { src: "images/tsum5.png", color: "#9b5de5" }
];

// 画像のプリロード
const tsumImages = TSUM_CONFIG.map((cfg) => {
  const img = new Image();
  img.src = cfg.src;
  return img;
});

// 物理エンジンの初期化
const engine = Engine.create();
engine.gravity.y = 6;

// 壁と床を作成（画面上部から降ってくるため、左右の壁は高く設定）
const wallOptions = { isStatic: true, friction: 0.1 };
const ground = Bodies.rectangle(WIDTH / 2, HEIGHT + 25, WIDTH + 100, 50, wallOptions);
const leftWall = Bodies.rectangle(-25, 0, 50, HEIGHT * 3, wallOptions);
const rightWall = Bodies.rectangle(WIDTH + 25, 0, 50, HEIGHT * 3, wallOptions);
Composite.add(engine.world, [ground, leftWall, rightWall]);

let tsums = [];
let selected = [];
let score = 0;
let timeLeft = GAME_DURATION;
let isPlaying = false;
let timerId = null;

// ツムを1つ生成して上から落とす
function spawnTsum(yOffset = 0) {
  const type = Math.floor(Math.random() * TSUM_CONFIG.length);
  const x = TSUM_RADIUS + Math.random() * (WIDTH - TSUM_RADIUS * 2);
  const y = -TSUM_RADIUS - yOffset;

  const body = Bodies.circle(x, y, TSUM_RADIUS, {
    restitution: 0.2,
    friction: 0.05,
    frictionAir: 0.01
  });
  body.tsumType = type;

  Composite.add(engine.world, body);
  tsums.push(body);
}

// ゲーム開始・リセット
function startGame() {
  // 既存のツムを削除
  tsums.forEach((t) => Composite.remove(engine.world, t));
  tsums = [];
  selected = [];

  score = 21000000000;
  timeLeft = GAME_DURATION;
  isPlaying = true;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  overlay.classList.add("hidden");

  // 初期配置のツムを時間差の高さから落とす
    // 初期配置のツムを横5列に並べて一気に落とす
  const cols = 29;
  const colWidth = (WIDTH - TSUM_RADIUS * 2) / (cols - 1);
  for (let i = 0; i < TSUM_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = TSUM_RADIUS + col * colWidth + (Math.random() - 0.5) * 10;
    const yOffset = row * (TSUM_RADIUS * 2.1);
    spawnTsum(yOffset, x);
  }


function endGame() {
  isPlaying = false;
  selected = [];
  clearInterval(timerId);
  overlayTitle.textContent = "TIME UP!";
  finalScoreEl.textContent = `SCORE: ${score}`;
  startBtn.textContent = "RETRY";
  overlay.classList.remove("hidden");
}

// シャッフル機能
function shuffleTsums() {
  if (!isPlaying) return;
  tsums.forEach((t) => {
    Body.setVelocity(t, {
      x: (Math.random() - 0.5) * 18,
      y: -10 - Math.random() * 10
    });
  });
}

// 画面座標をCanvas内部座標に変換
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WIDTH / rect.width),
    y: (e.clientY - rect.top) * (HEIGHT / rect.height)
  };
}

function getDistance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// なぞり操作の処理
canvas.addEventListener("pointerdown", (e) => {
  if (!isPlaying) return;
  const pos = getPointerPos(e);

  for (const t of tsums) {
    if (getDistance(pos, t.position) <= TSUM_RADIUS * 1.15) {
      selected = [t];
      break;
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!isPlaying || selected.length === 0) return;
  const pos = getPointerPos(e);
  const targetType = selected[0].tsumType;

  // 1つ前のツムに戻ったら選択を解除（戻る操作）
  if (selected.length >= 2) {
    const prevTsum = selected[selected.length - 2];
    if (getDistance(pos, prevTsum.position) <= TSUM_RADIUS * 1.1) {
      selected.pop();
      return;
    }
  }

  // 隣接する同じ種類のツムをチェーンに追加
  const lastTsum = selected[selected.length - 1];
  for (const t of tsums) {
    if (t.tsumType !== targetType || selected.includes(t)) continue;

    const distToPointer = getDistance(pos, t.position);
    const distToLast = getDistance(lastTsum.position, t.position);

    if (distToPointer <= TSUM_RADIUS * 1.15 && distToLast <= TSUM_RADIUS * 2.8) {
      selected.push(t);
      break;
    }
  }
});

window.addEventListener("pointerup", () => {
  if (!isPlaying || selected.length === 0) return;

  // 3つ以上つながっていたら消去＆スコア加算
  if (selected.length >= 3) {
    const chainCount = selected.length;
    const gained = Math.floor(chainCount * 100 * (1 + (chainCount - 3) * 0.25));
    score += gained;
    scoreEl.textContent = score;

    selected.forEach((t) => {
      Composite.remove(engine.world, t);
      tsums = tsums.filter((item) => item !== t);
      spawnTsum(Math.random() * 100);
    });
  }

  selected = [];
});

startBtn.addEventListener("click", startGame);
shuffleBtn.addEventListener("click", shuffleTsums);

// 描画ループ
function render() {
  Engine.update(engine, 1000 / 60);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // ツムの描画
  for (const t of tsums) {
    const { x, y } = t.position;
    const img = tsumImages[t.tsumType];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t.angle);

    // 円形にクリッピング
    ctx.beginPath();
    ctx.arc(0, 0, TSUM_RADIUS - 1, 0, Math.PI * 2);
    ctx.clip();

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -TSUM_RADIUS, -TSUM_RADIUS, TSUM_RADIUS * 2, TSUM_RADIUS * 2);
    } else {
      // 画像がまだ置かれていない場合の仮表示
      ctx.fillStyle = TSUM_CONFIG[t.tsumType].color;
      ctx.fillRect(-TSUM_RADIUS, -TSUM_RADIUS, TSUM_RADIUS * 2, TSUM_RADIUS * 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.tsumType + 1, 0, 0);
    }
    ctx.restore();

    // 選択中のハイライト枠
    if (selected.includes(t)) {
      ctx.beginPath();
      ctx.arc(x, y, TSUM_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  // なぞっている線の描画
  if (selected.length > 1) {
    ctx.beginPath();
    ctx.moveTo(selected[0].position.x, selected[0].position.y);
    for (let i = 1; i < selected.length; i++) {
      ctx.lineTo(selected[i].position.x, selected[i].position.y);
    }
    ctx.strokeStyle = "rgba(255, 235, 59, 0.75)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  requestAnimationFrame(render);
}

render();
