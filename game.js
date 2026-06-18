const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const startBtn = document.querySelector("#startBtn");
const exitBtn = document.querySelector("#exitBtn");
const nextBtn = document.querySelector("#nextBtn");
const scoreText = document.querySelector("#scoreText");
const progressText = document.querySelector("#progressText");
const modalOverlay = document.querySelector("#modalOverlay");
const modalTitle = document.querySelector("#modalTitle");
const modalMessage = document.querySelector("#modalMessage");
const pedalButtons = [...document.querySelectorAll("[data-pedal]")];

const keys = new Set();
let lastFrame = performance.now();
let audioContext = null;

const assets = {
  machine: new Image(),
  machineArm: new Image(),
  needle: new Image(),
  bun: new Image(),
  garment: new Image(),
};
assets.machine.src = "./assets/sewing-machine-table.png";
assets.machineArm.src = "./assets/machine-arm-overlay.png?v=7";
assets.needle.src = "./assets/needle-overlay.png?v=7";
assets.bun.src = "./assets/mantou.png";
assets.garment.src = "./assets/garment-clean.png?v=3";
const garmentLayer = document.createElement("canvas");
garmentLayer.width = 620;
garmentLayer.height = 520;
const garmentCtx = garmentLayer.getContext("2d");

const game = {
  width: 1280,
  height: 760,
  bg: { x: 0, y: 0, w: 1280, h: 720 },
  tableY: 520,
  running: false,
  finished: false,
  level: 1,
  score: 0,
  cloth: { x: 0, y: 0, vx: 0, vy: 0 },
  clothScale: 1,
  garment: { hue: 42, base: "#ead5ad", dark: "#9d7654", light: "#fff1cd", pattern: null },
  needle: { x: 640, y: 302 },
  target: [],
  targetLength: 0,
  targetCum: [],
  progress: 0,
  sewnLength: 0,
  stitches: [],
  stitchStats: [],
  lastStitchAt: 0,
  wheelRpm: 0,
  rhythm: 0,
  expectedPedal: "KeyJ",
  activePedal: null,
  stepRemaining: 0,
  blockedMoveTime: 0,
  hintCooldown: 0,
  isMobile: false,
  touchDragging: false,
  touchPointerId: null,
  touchStartX: 0,
  touchStartY: 0,
  touchMoveX: 0,
  touchMoveY: 0,
  touchMoveGrace: 0,
  shake: 0,
  flash: 0,
  whipTimer: 0,
  eventText: "",
  eventTimer: 0,
  modalTimer: 0,
  buns: 0,
  thrownBuns: [],
};

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function ensureAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playSewingSound() {
  const audio = ensureAudio();
  const now = audio.currentTime;
  for (let i = 0; i < 3; i += 1) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    osc.type = "square";
    osc.frequency.setValueAtTime(92 + i * 18, now + i * 0.045);
    filter.type = "lowpass";
    filter.frequency.value = 720;
    gain.gain.setValueAtTime(0.0001, now + i * 0.045);
    gain.gain.exponentialRampToValueAtTime(0.065, now + i * 0.045 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.055);
    osc.connect(filter).connect(gain).connect(audio.destination);
    osc.start(now + i * 0.045);
    osc.stop(now + i * 0.045 + 0.065);
  }
}

function playWhipSound() {
  const audio = ensureAudio();
  const now = audio.currentTime;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.32), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 6);
  }
  const noise = audio.createBufferSource();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(0.42, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  noise.buffer = buffer;
  noise.connect(filter).connect(gain).connect(audio.destination);
  noise.start(now);

  const snap = audio.createOscillator();
  const snapGain = audio.createGain();
  snap.type = "sawtooth";
  snap.frequency.setValueAtTime(1700, now);
  snap.frequency.exponentialRampToValueAtTime(210, now + 0.18);
  snapGain.gain.setValueAtTime(0.2, now);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  snap.connect(snapGain).connect(audio.destination);
  snap.start(now);
  snap.stop(now + 0.21);
}

function makeGarmentStyle() {
  const previousHue = game.garment?.hue ?? 0;
  let hue = rand(0, 360);
  while (Math.min(Math.abs(hue - previousHue), 360 - Math.abs(hue - previousHue)) < 58) {
    hue = rand(0, 360);
  }
  const saturation = rand(26, 52);
  const lightness = rand(62, 78);
  return {
    hue,
    base: `hsl(${hue} ${saturation}% ${lightness}%)`,
    dark: `hsl(${hue} ${saturation * 0.82}% ${Math.max(28, lightness - 28)}%)`,
    light: `hsl(${hue} ${Math.min(78, saturation + 10)}% ${Math.min(92, lightness + 14)}%)`,
    thread: `hsl(${(hue + 170) % 360} 62% 35%)`,
    verticalFolds: Array.from({ length: 7 }, (_, i) => ({
      x: -170 + i * 58 + rand(-8, 8),
      bend: rand(-18, 18),
    })),
    horizontalFolds: Array.from({ length: 5 }, (_, i) => ({
      y: -120 + i * 70 + rand(-8, 8),
      bend: rand(-18, 18),
    })),
    pattern: makeFabricPattern(hue, saturation, lightness),
  };
}

function makeFabricPattern(hue, saturation, lightness) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 420;
  patternCanvas.height = 420;
  const pctx = patternCanvas.getContext("2d");
  pctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
  pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

  const warp = `hsla(${hue} ${Math.min(80, saturation + 16)}% ${Math.min(92, lightness + 18)}% / 0.32)`;
  const weft = `hsla(${hue} ${saturation}% ${Math.max(30, lightness - 24)}% / 0.2)`;
  for (let x = 0; x < patternCanvas.width; x += 7) {
    pctx.strokeStyle = x % 14 === 0 ? warp : weft;
    pctx.lineWidth = x % 14 === 0 ? 1.2 : 0.6;
    pctx.beginPath();
    pctx.moveTo(x + rand(-0.6, 0.6), 0);
    pctx.lineTo(x + rand(-0.6, 0.6), patternCanvas.height);
    pctx.stroke();
  }
  for (let y = 0; y < patternCanvas.height; y += 6) {
    pctx.strokeStyle = y % 12 === 0 ? weft : warp;
    pctx.lineWidth = y % 12 === 0 ? 1.1 : 0.45;
    pctx.beginPath();
    pctx.moveTo(0, y + rand(-0.5, 0.5));
    pctx.lineTo(patternCanvas.width, y + rand(-0.5, 0.5));
    pctx.stroke();
  }
  for (let i = 0; i < 1800; i += 1) {
    const alpha = rand(0.02, 0.075);
    pctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    pctx.fillRect(rand(0, patternCanvas.width), rand(0, patternCanvas.height), rand(0.6, 1.8), rand(0.6, 1.8));
  }
  return patternCanvas;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.width = rect.width;
  game.height = rect.height;

  const ratio = assets.machine.naturalWidth
    ? assets.machine.naturalWidth / assets.machine.naturalHeight
    : 16 / 9;
  let w = game.width * 0.98;
  let h = w / ratio;
  if (h > game.height * 0.98) {
    h = game.height * 0.98;
    w = h * ratio;
  }
  game.bg = {
    x: (game.width - w) / 2,
    y: (game.height - h) / 2,
    w,
    h,
  };
  game.needle.x = game.bg.x + game.bg.w * 0.4515;
  game.needle.y = game.bg.y + game.bg.h * 0.418;
  game.tableY = game.bg.y + game.bg.h * 0.78;
  game.clothScale = clamp((game.bg.w / 1700) * 1.2, 0.66, 1.08);
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const touchPrimary = matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0;
  game.isMobile = mobileUserAgent || touchPrimary;
  document.body.classList.toggle("mobile-mode", game.isMobile);
}

function showStartModal() {
  modalTitle.textContent = "踩缝纫机";
  modalMessage.textContent = game.isMobile
    ? "按住衣服滑动方向，交替点 J / K 踩踏板。"
    : "按 WASD 移动布料，交替按住 J / K 踩踏板。";
  startBtn.hidden = false;
  exitBtn.hidden = true;
  nextBtn.hidden = true;
  modalOverlay.classList.remove("hidden");
}

function showNextModal() {
  modalTitle.textContent = `第 ${game.level} 件完成`;
  modalMessage.textContent = `本关得分 ${game.score}，继续下一关或退出游戏。`;
  startBtn.hidden = true;
  exitBtn.hidden = false;
  nextBtn.hidden = false;
  modalOverlay.classList.remove("hidden");
}

function hideModal() {
  modalOverlay.classList.add("hidden");
  startBtn.hidden = true;
  exitBtn.hidden = true;
  nextBtn.hidden = true;
}

function updateStats() {
  const progress = game.targetLength ? Math.round((game.progress / game.targetLength) * 100) : 0;
  scoreText.textContent = String(game.score);
  progressText.textContent = `${clamp(progress, 0, 100)}%`;
  for (const button of pedalButtons) {
    const code = button.dataset.pedal;
    button.classList.toggle("expected", game.running && code === game.expectedPedal);
    button.classList.toggle(
      "active",
      code === game.activePedal && (keys.has(code) || (game.isMobile && game.stepRemaining > 0)),
    );
  }
}

function showHint(message, duration = 1.6) {
  if (!game.running || game.eventTimer > 0.4) return;
  game.eventText = message;
  game.eventTimer = duration;
}

function segmentIntersects(a, b, c, d) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

const garmentOutline = [
  { x: -190, y: -185 },
  { x: -70, y: -185 },
  { x: -42, y: -153 },
  { x: 0, y: -147 },
  { x: 42, y: -153 },
  { x: 70, y: -185 },
  { x: 190, y: -185 },
  { x: 252, y: -78 },
  { x: 164, y: -32 },
  { x: 138, y: 190 },
  { x: -138, y: 190 },
  { x: -164, y: -32 },
  { x: -252, y: -78 },
];

function pointInGarment(point) {
  let inside = false;
  for (let i = 0, j = garmentOutline.length - 1; i < garmentOutline.length; j = i, i += 1) {
    const a = garmentOutline[i];
    const b = garmentOutline[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointToSegmentDistance(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / lenSq, 0, 1);
  return dist(point, { x: a.x + vx * t, y: a.y + vy * t });
}

function makeTarget(level) {
  const entrySide = Math.floor(rand(0, 3));
  let current;
  let angle;
  if (entrySide === 0) {
    const y = rand(10, 135);
    const edgeX = 164 - (26 * (y + 32)) / 222 - 4;
    current = { x: -edgeX, y };
    angle = rand(-0.2, 0.2);
  } else if (entrySide === 1) {
    const y = rand(10, 135);
    const edgeX = 164 - (26 * (y + 32)) / 222 - 4;
    current = { x: edgeX, y };
    angle = Math.PI + rand(-0.2, 0.2);
  } else {
    current = { x: rand(-105, 105), y: 184 };
    angle = -Math.PI / 2 + rand(-0.2, 0.2);
  }

  const points = [current];
  const safeBounds = { left: -124, right: 124, top: -118, bottom: 166 };
  const wanted = 10 + Math.min(4, Math.floor(level / 2));

  let attempts = 0;
  while (points.length < wanted && attempts < 1200) {
    attempts += 1;
    angle += rand(-0.48, 0.48);
    const step = rand(50, 76);
    const next = {
      x: current.x + Math.cos(angle) * step,
      y: current.y + Math.sin(angle) * step,
    };
    if (
      next.x < safeBounds.left ||
      next.x > safeBounds.right ||
      next.y < safeBounds.top ||
      next.y > safeBounds.bottom ||
      !pointInGarment(next)
    ) {
      angle += Math.PI * rand(0.45, 0.75);
      continue;
    }

    let conflicts = false;
    for (let i = 0; i < points.length - 2; i += 1) {
      if (
        segmentIntersects(points[i], points[i + 1], current, next) ||
        pointToSegmentDistance(next, points[i], points[i + 1]) < 38
      ) {
        conflicts = true;
        break;
      }
    }
    if (!conflicts) {
      points.push(next);
      current = next;
    }
  }

  return points.length < 8 ? makeTarget(Math.max(1, level - 1)) : points;
}

function computeLengths(points) {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += dist(points[i - 1], points[i]);
    cum.push(total);
  }
  game.targetCum = cum;
  game.targetLength = total;
}

function resetLevel(nextLevel = game.level) {
  resizeCanvas();
  game.running = true;
  game.finished = false;
  game.level = nextLevel;
  game.score = 0;
  game.target = makeTarget(game.level);
  computeLengths(game.target);
  game.garment = makeGarmentStyle();
  game.cloth = {
    x: -game.target[0].x * game.clothScale,
    y: -game.target[0].y * game.clothScale,
    vx: 0,
    vy: 0,
  };
  game.progress = 0;
  game.sewnLength = 0;
  game.stitches = [];
  game.stitchStats = [];
  game.lastStitchAt = performance.now();
  game.wheelRpm = 0;
  game.rhythm = 0;
  game.expectedPedal = "KeyJ";
  game.activePedal = null;
  game.stepRemaining = 0;
  game.blockedMoveTime = 0;
  game.hintCooldown = 0;
  game.touchDragging = false;
  game.touchPointerId = null;
  game.touchMoveX = 0;
  game.touchMoveY = 0;
  game.touchMoveGrace = 0;
  game.shake = 0;
  game.flash = 0;
  game.whipTimer = 0;
  game.eventText = "";
  game.eventTimer = 0;
  game.modalTimer = 0;
  hideModal();
  updateStats();
}

function clothOrigin() {
  return {
    x: game.needle.x + game.cloth.x,
    y: game.needle.y + game.cloth.y,
  };
}

function needleInCloth() {
  const origin = clothOrigin();
  return {
    x: (game.needle.x - origin.x) / game.clothScale,
    y: (game.needle.y - origin.y) / game.clothScale,
  };
}

function nearestOnTarget(point) {
  let best = { distance: Infinity, arclen: 0, point: game.target[0] };
  for (let i = 0; i < game.target.length - 1; i += 1) {
    const a = game.target[i];
    const b = game.target[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy || 1;
    const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / lenSq, 0, 1);
    const proj = { x: a.x + vx * t, y: a.y + vy * t };
    const d = dist(point, proj);
    if (d < best.distance) {
      best = {
        distance: d,
        arclen: game.targetCum[i] + Math.sqrt(lenSq) * t,
        point: proj,
      };
    }
  }
  return best;
}

function pointAtArclen(arclen) {
  const target = clamp(arclen, 0, game.targetLength);
  for (let i = 0; i < game.targetCum.length - 1; i += 1) {
    if (target >= game.targetCum[i] && target <= game.targetCum[i + 1]) {
      const a = game.target[i];
      const b = game.target[i + 1];
      const span = game.targetCum[i + 1] - game.targetCum[i] || 1;
      const t = (target - game.targetCum[i]) / span;
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
  }
  const last = game.target[game.target.length - 1];
  const prev = game.target[game.target.length - 2];
  return { ...last, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
}

function calculateScore() {
  if (!game.stitchStats.length) return 0;
  const samples = game.stitchStats;
  const lineAvg =
    samples.reduce((sum, s) => sum + clamp(1 - s.distance / 58, 0, 1), 0) / samples.length;
  const gapAvg =
    samples.reduce((sum, s) => sum + clamp(1 - Math.abs(s.gap - 17) / 17, 0, 1), 0) / samples.length;
  const progressFactor = clamp(game.progress / game.targetLength, 0, 1);
  return Math.round((lineAvg * 0.68 + gapAvg * 0.32) * progressFactor * 100);
}

function finishLevel() {
  game.running = false;
  game.finished = true;
  game.score = calculateScore();
  game.modalTimer = 2.6;

  if (game.score > 60) {
    game.buns += 2;
    for (let i = 0; i < 2; i += 1) {
      game.thrownBuns.push({
        x: game.width + 150 + i * 105,
        y: game.bg.y + game.bg.h * (0.06 + i * 0.05),
        vx: -610 - i * 75,
        vy: 180 + i * 55,
        spin: rand(-4, 4),
        r: 0,
        size: Math.min(230, game.bg.w * 0.18),
        bounces: 0,
      });
    }
    game.modalTimer = 3.2;
    game.eventText = "奖励你两个馒头";
    game.eventTimer = 3;
  } else {
    game.flash = 1;
    game.shake = 34;
    game.whipTimer = 0.95;
    game.eventText = "挨了一鞭";
    game.eventTimer = 2.4;
    playWhipSound();
  }
  updateStats();
}

function updateThrownBuns(dt) {
  for (const bun of game.thrownBuns) {
    bun.x += bun.vx * dt;
    bun.y += bun.vy * dt;
    bun.vy += 1120 * dt;
    bun.r += bun.spin * dt;
    const floor = game.tableY - bun.size * 0.25;
    if (bun.y > floor) {
      bun.y = floor;
      bun.vy *= bun.bounces < 2 ? -0.44 : -0.14;
      bun.vx *= 0.72;
      bun.spin *= 0.7;
      bun.bounces += 1;
    }
  }
}

function update(dt, now) {
  resizeCanvas();

  game.score = game.finished ? game.score : calculateScore();
  game.shake = Math.max(0, game.shake - dt * 22);
  game.flash = Math.max(0, game.flash - dt * 1.8);
  game.whipTimer = Math.max(0, game.whipTimer - dt);
  game.eventTimer = Math.max(0, game.eventTimer - dt);
  game.modalTimer = Math.max(0, game.modalTimer - dt);
  game.hintCooldown = Math.max(0, game.hintCooldown - dt);
  game.touchMoveGrace = Math.max(0, game.touchMoveGrace - dt);
  if (!game.touchDragging && game.touchMoveGrace === 0) {
    game.touchMoveX = 0;
    game.touchMoveY = 0;
  }
  updateThrownBuns(dt);

  if (game.finished && game.modalTimer === 0 && modalOverlay.classList.contains("hidden")) {
    showNextModal();
  }

  if (!game.running) {
    updateStats();
    return;
  }

  const pedalHeld = game.activePedal && (game.isMobile || keys.has(game.activePedal));
  const targetRpm = pedalHeld && game.stepRemaining > 0 ? 340 + game.rhythm * 300 : 0;
  game.wheelRpm = lerp(game.wheelRpm, targetRpm, 1 - Math.pow(0.001, dt));
  game.rhythm = clamp(game.rhythm - dt * 0.035, 0, 1);

  const mx = game.isMobile
    ? game.touchMoveX
    : (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const my = game.isMobile
    ? game.touchMoveY
    : (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const wantsMove = mx !== 0 || my !== 0;
  const mag = Math.hypot(mx, my) || 1;
  const canFeed = wantsMove && pedalHeld && game.stepRemaining > 0;
  const feedSpeed = (72 + game.rhythm * 180 + game.wheelRpm * 0.08) * game.clothScale;
  if (canFeed) {
    const step = Math.min(feedSpeed * dt, game.stepRemaining);
    game.cloth.x += (mx / mag) * step;
    game.cloth.y += (my / mag) * step;
    game.stepRemaining -= step;
    game.blockedMoveTime = 0;
  } else if (wantsMove) {
    game.blockedMoveTime += dt;
    if (game.blockedMoveTime > 0.55 && game.hintCooldown === 0) {
      showHint("按住 J 或 K 才能移动衣服");
      game.hintCooldown = 2.5;
    }
    if (game.blockedMoveTime >= 3) {
      showHint("需要交替按住 J、K 踩踏板", 2.2);
      game.blockedMoveTime = 0;
      game.hintCooldown = 2.5;
    }
  } else {
    game.blockedMoveTime = 0;
  }
  game.cloth.vx = 0;
  game.cloth.vy = 0;
  game.cloth.x = clamp(game.cloth.x, -game.bg.w * 0.43, game.bg.w * 0.34);
  game.cloth.y = clamp(game.cloth.y, -game.bg.h * 0.36, game.bg.h * 0.3);

  const needlePoint = needleInCloth();
  const needleOnGarment = pointInGarment(needlePoint);
  if (canFeed && needleOnGarment) {
    game.shake = Math.max(game.shake, 1.4);
  }

  const stitchInterval = clamp(320 - game.wheelRpm * 0.34, 42, 260);
  if (
    canFeed &&
    needleOnGarment &&
    game.wheelRpm > 90 &&
    now - game.lastStitchAt >= stitchInterval
  ) {
    const p = needlePoint;
    const previous = game.stitches[game.stitches.length - 1];
    const gap = previous ? dist(previous, p) : 17;
    const nearest = nearestOnTarget(p);
    game.stitches.push({ ...p, good: nearest.distance < 34, gap });
    game.stitchStats.push({ distance: nearest.distance, gap });
    if (previous) game.sewnLength += gap;
    game.progress = clamp(game.sewnLength / 1.5, 0, game.targetLength);
    if (nearest.distance > 70) {
      game.rhythm = clamp(game.rhythm - 0.012, 0, 1);
    }
    game.lastStitchAt = now;
  }

  if (game.sewnLength >= game.targetLength * 1.5 && game.stitches.length > 22) {
    finishLevel();
  }
  updateStats();
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGarmentPath(targetCtx = ctx) {
  targetCtx.beginPath();
  targetCtx.moveTo(-190, -185);
  targetCtx.lineTo(-70, -185);
  targetCtx.quadraticCurveTo(-42, -147, 0, -147);
  targetCtx.quadraticCurveTo(42, -147, 70, -185);
  targetCtx.lineTo(190, -185);
  targetCtx.lineTo(252, -78);
  targetCtx.lineTo(164, -32);
  targetCtx.lineTo(138, 190);
  targetCtx.lineTo(-138, 190);
  targetCtx.lineTo(-164, -32);
  targetCtx.lineTo(-252, -78);
  targetCtx.closePath();
}

function strokeTargetPath(targetCtx = ctx) {
  targetCtx.beginPath();
  targetCtx.moveTo(game.target[0].x, game.target[0].y);
  for (let i = 1; i < game.target.length - 1; i += 1) {
    const mid = {
      x: (game.target[i].x + game.target[i + 1].x) / 2,
      y: (game.target[i].y + game.target[i + 1].y) / 2,
    };
    targetCtx.quadraticCurveTo(game.target[i].x, game.target[i].y, mid.x, mid.y);
  }
  const last = game.target[game.target.length - 1];
  targetCtx.lineTo(last.x, last.y);
  targetCtx.stroke();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#171311");
  gradient.addColorStop(1, "#050505");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  if (assets.machine.complete && assets.machine.naturalWidth) {
    ctx.drawImage(assets.machine, game.bg.x, game.bg.y, game.bg.w, game.bg.h);
  } else {
    ctx.fillStyle = "#6a4327";
    drawRoundedRect(game.bg.x, game.bg.y, game.bg.w, game.bg.h * 0.86, 20);
    ctx.fill();
  }
}

function drawMachineArmOverlay() {
  if (!assets.machineArm.complete || !assets.machineArm.naturalWidth) return;
  const { x, y, w, h } = game.bg;
  ctx.drawImage(assets.machineArm, x, y, w, h);
  if (assets.needle.complete && assets.needle.naturalWidth) {
    ctx.drawImage(assets.needle, x, y, w, h);
  }
}

function drawCloth() {
  if (!game.target.length) return;
  const origin = clothOrigin();
  garmentCtx.clearRect(0, 0, garmentLayer.width, garmentLayer.height);
  garmentCtx.save();
  garmentCtx.translate(garmentLayer.width / 2, garmentLayer.height / 2);
  drawGarmentPath(garmentCtx);
  garmentCtx.clip();

  if (assets.garment.complete && assets.garment.naturalWidth) {
    garmentCtx.drawImage(assets.garment, -280, -220, 560, 460);
    garmentCtx.globalCompositeOperation = "multiply";
    garmentCtx.fillStyle = `hsl(${game.garment.hue} 48% 68%)`;
    garmentCtx.fillRect(-310, -260, 620, 520);
    garmentCtx.globalCompositeOperation = "source-over";
  }

  garmentCtx.strokeStyle = "#c9352c";
  garmentCtx.lineWidth = 8;
  garmentCtx.lineCap = "round";
  garmentCtx.lineJoin = "round";
  garmentCtx.setLineDash([18, 12]);
  strokeTargetPath(garmentCtx);
  garmentCtx.setLineDash([]);

  garmentCtx.strokeStyle = "#161616";
  garmentCtx.lineWidth = 4;
  garmentCtx.beginPath();
  for (let i = 0; i < game.stitches.length; i += 1) {
    const stitch = game.stitches[i];
    if (i === 0) garmentCtx.moveTo(stitch.x, stitch.y);
    else garmentCtx.lineTo(stitch.x, stitch.y);
  }
  garmentCtx.stroke();

  for (const stitch of game.stitches) {
    garmentCtx.beginPath();
    garmentCtx.arc(stitch.x, stitch.y, stitch.good ? 2.4 : 3.8, 0, Math.PI * 2);
    garmentCtx.fillStyle = stitch.good ? "#111" : "#1f7ac8";
    garmentCtx.fill();
  }

  const guide = pointAtArclen(game.progress + 55);
  garmentCtx.save();
  garmentCtx.translate(guide.x, guide.y);
  garmentCtx.rotate(guide.angle);
  garmentCtx.fillStyle = "#1f9d6a";
  garmentCtx.beginPath();
  garmentCtx.moveTo(24, 0);
  garmentCtx.lineTo(-14, -14);
  garmentCtx.lineTo(-6, 0);
  garmentCtx.lineTo(-14, 14);
  garmentCtx.closePath();
  garmentCtx.fill();
  garmentCtx.restore();
  garmentCtx.restore();
  garmentCtx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.scale(game.clothScale, game.clothScale);
  ctx.shadowColor = "rgba(0,0,0,0.46)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(garmentLayer, -garmentLayer.width / 2, -garmentLayer.height / 2);
  ctx.restore();
}

function drawBun(bun) {
  ctx.save();
  ctx.translate(bun.x, bun.y);
  ctx.rotate(bun.r);
  const size = bun.size;
  if (assets.bun.complete && assets.bun.naturalWidth) {
    ctx.drawImage(assets.bun, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#efe0c1";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.45, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWhipAndEventText() {
  if (game.whipTimer > 0) {
    const t = game.whipTimer / 0.95;
    ctx.save();
    ctx.globalAlpha = clamp(t * 1.35, 0, 1);
    ctx.strokeStyle = "#120806";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(game.width * 0.06, game.height * 0.18);
    ctx.bezierCurveTo(
      game.width * 0.34,
      game.height * (0.62 - t * 0.16),
      game.width * 0.62,
      game.height * (0.08 + t * 0.22),
      game.width * 0.94,
      game.height * 0.54,
    );
    ctx.stroke();
    ctx.strokeStyle = "#d8a16d";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
  }

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(125, 0, 0, ${game.flash * 0.36})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }

  if (game.eventTimer > 0 && game.eventText) {
    ctx.save();
    ctx.globalAlpha = clamp(game.eventTimer, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    drawRoundedRect(game.width / 2 - 180, game.height * 0.16 - 36, 360, 72, 8);
    ctx.fill();
    ctx.fillStyle = "#fff7eb";
    ctx.font = "900 30px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(game.eventText, game.width / 2, game.height * 0.16);
    ctx.restore();
  }
}

function drawScene() {
  const sx = game.shake ? rand(-game.shake, game.shake) : 0;
  const sy = game.shake ? rand(-game.shake, game.shake) : 0;
  ctx.clearRect(0, 0, game.width, game.height);
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();
  drawCloth();
  drawMachineArmOverlay();
  for (const bun of game.thrownBuns) {
    drawBun(bun);
  }
  drawWhipAndEventText();

  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.04, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt, now);
  drawScene();
  requestAnimationFrame(loop);
}

function setKey(code, down) {
  if (down) keys.add(code);
  else keys.delete(code);
}

function pressPedal(code) {
  if (!game.running) return;
  if (code === game.expectedPedal) {
    game.activePedal = code;
    game.stepRemaining = 46 * game.clothScale;
    game.expectedPedal = code === "KeyJ" ? "KeyK" : "KeyJ";
    game.rhythm = clamp(game.rhythm + 0.12, 0, 1);
    game.blockedMoveTime = 0;
    playSewingSound();
  } else {
    const keyName = game.expectedPedal === "KeyJ" ? "J" : "K";
    showHint(`需要换成按住 ${keyName}`);
    game.rhythm = clamp(game.rhythm - 0.08, 0, 1);
  }
  updateStats();
}

function releasePedal(code, preserveMobileStep = false) {
  setKey(code, false);
  if (code === game.activePedal && !preserveMobileStep) {
    game.activePedal = null;
    game.stepRemaining = 0;
  }
  updateStats();
}

window.addEventListener("keydown", (event) => {
  if (!["KeyW", "KeyA", "KeyS", "KeyD", "KeyJ", "KeyK"].includes(event.code)) return;
  event.preventDefault();
  if (!keys.has(event.code) && (event.code === "KeyJ" || event.code === "KeyK")) {
    pressPedal(event.code);
  }
  setKey(event.code, true);
});

window.addEventListener("keyup", (event) => {
  releasePedal(event.code, false);
});

for (const button of pedalButtons) {
  const code = button.dataset.pedal;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (!keys.has(code)) pressPedal(code);
    setKey(code, true);
    updateStats();
  });
  const release = (event) => {
    event.preventDefault();
    releasePedal(code, game.isMobile);
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!game.running || !game.isMobile) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const origin = clothOrigin();
  const localX = (x - origin.x) / game.clothScale;
  const localY = (y - origin.y) / game.clothScale;
  if (Math.abs(localX) > 300 || localY < -230 || localY > 235) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  game.touchDragging = true;
  game.touchPointerId = event.pointerId;
  game.touchStartX = x;
  game.touchStartY = y;
  game.touchMoveX = 0;
  game.touchMoveY = 0;
});

canvas.addEventListener("pointermove", (event) => {
  if (!game.touchDragging || event.pointerId !== game.touchPointerId) return;
  const rect = canvas.getBoundingClientRect();
  const dx = event.clientX - rect.left - game.touchStartX;
  const dy = event.clientY - rect.top - game.touchStartY;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 10) {
    game.touchMoveX = dx / magnitude;
    game.touchMoveY = dy / magnitude;
  }
});

function endTouchDrag(event) {
  if (event.pointerId !== game.touchPointerId) return;
  game.touchDragging = false;
  game.touchPointerId = null;
  game.touchMoveGrace = 0.16;
}

canvas.addEventListener("pointerup", endTouchDrag);
canvas.addEventListener("pointercancel", endTouchDrag);

startBtn.addEventListener("click", () => {
  ensureAudio();
  game.level = 1;
  game.buns = 0;
  game.thrownBuns = [];
  resetLevel(1);
});

exitBtn.addEventListener("click", () => {
  keys.clear();
  game.buns = 0;
  game.thrownBuns = [];
  resetLevel(1);
  game.running = false;
  game.activePedal = null;
  game.stepRemaining = 0;
  updateStats();
  showStartModal();
});

nextBtn.addEventListener("click", () => {
  ensureAudio();
  resetLevel(game.level + 1);
});

window.addEventListener("resize", resizeCanvas);
assets.machine.addEventListener("load", resizeCanvas);
assets.machineArm.addEventListener("load", resizeCanvas);
assets.needle.addEventListener("load", resizeCanvas);
assets.bun.addEventListener("load", resizeCanvas);
assets.garment.addEventListener("load", resizeCanvas);
resizeCanvas();
game.target = makeTarget(1);
computeLengths(game.target);
game.garment = makeGarmentStyle();
updateStats();
showStartModal();
requestAnimationFrame(loop);
