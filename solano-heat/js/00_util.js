// ---------- Core helpers & constants ----------
const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
function wrapAngle(a) {
  if (!Number.isFinite(a)) return 0;
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
function dampAngle(cur, target, rate, dt) { return cur + wrapAngle(target - cur) * (1 - Math.exp(-rate * dt)); }
function rnd(a, b) { return a + (b - a) * Math.random(); }
function rndi(a, b) { return Math.floor(a + (b - a + 1) * Math.random()); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const srng = makeRng(20261011);
function sr(a, b) { return a + (b - a) * srng(); }
function sri(a, b) { return Math.floor(a + (b - a + 1) * srng()); }
function spick(arr) { return arr[Math.floor(srng() * arr.length)]; }
function hexRgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
function fmtMoney(n) { return '$' + Math.max(0, Math.round(n)).toLocaleString('en-US'); }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

// City layout (metres). x = east, z = south, y = up.
const NB = 10;              // blocks per axis
const BLOCK = 76;           // block size including sidewalks
const ROAD = 18;            // road width
const HALF_ROAD = ROAD / 2;
const SP = BLOCK + ROAD;    // node spacing (94)
const LANE = 3.0;           // driving-lane centre offset
const PARK_LANE = 7.0;      // parking-lane centre offset
const CURB = 0.15;
const SIDEWALK = 4;
const STOP_DIST = 13;       // stop line distance from node centre
const WORLD_MAX = NB * SP;  // 940
const BEACH_X0 = WORLD_MAX + HALF_ROAD; // 949
const SHORE_X = BEACH_X0 + 64;          // 1013
const DOCK_Z = WORLD_MAX + HALF_ROAD + 30; // 979
const PIER_Z = 4 * SP + SP / 2;         // 423
const BOUND = { x0: -70, x1: SHORE_X - 1.5, z0: -70, z1: DOCK_Z - 1 };
const GRAV = 18;

function blockRect(i, j) {
  const x0 = i * SP + HALF_ROAD, z0 = j * SP + HALF_ROAD;
  return { x0, z0, x1: x0 + BLOCK, z1: z0 + BLOCK };
}
