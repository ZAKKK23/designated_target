/* ===========================================================
   VTP — Target Field  |  live simulation
   Ported from the MATLAB model (matlab/dynamics.m). This is the
   Voronoi Topological Perception (VTP) model on the plane:
     - Neighbors are TOPOLOGICAL: an agent's neighbors are its
       Delaunay-triangulation neighbors (computed here with a small
       built-in Bowyer-Watson triangulation — no external libraries).
     - Repulsion from the nearest neighbor, fading out with distance
       (expReciprocal transition, length scale L).
     - Alignment with Delaunay neighbors, weighted by how well their
       headings already agree (alignTo.m).
     - Homing toward the nearest target, with weight (1 - s) so that
       repulsion takes priority when an agent is crowded.
     - Speed governor: each agent moves at tanh(l/L) times its desired
       velocity, where l is the distance from the agent to its Voronoi
       cell boundary along the direction of motion (so crowded agents
       slow down, agents on the hull move at full speed).
   TARGET FIELD (the scenario this repo is about):
     - a rectangular lattice of STATIC point targets across the plane,
       with independent spacing in x and in y, that moves rigidly around a
       circle centered on the origin (radius and speed you choose live)
     - ONE COLLECTOR target that does not oscillate: it goes after the
       agents. An agent that comes within the capture radius STICKS to it
       and from then on homes toward a blend of the collector and its
       nearest lattice target (weight fieldWeight), so it keeps feeling the
       target field, until it drifts past the release radius. The collector seeks the nearest agent that is not stuck,
       and slows down as the centroid of its stuck agents trails behind
       it (stopping when the lag reaches the keep-close distance), so it
       moves in a way that keeps its collected agents close.
   Every other agent homes toward whichever target (static or collector)
   is nearest to it.
   =========================================================== */

const PARAMS = {
  N_DEFAULT: 400,
  L: 1,                 // interaction length scale (MATLAB: L = 1); also M0 for the speed governor
  NU_DEFAULT: 2.5,      // alignment strength (live-editable: sim.nu)
  GRID_HALF: 50,        // static lattice covers [-GRID_HALF, GRID_HALF]^2
  GRID_SPACING_X: 5,    // one static target every GRID_SPACING_X units in x
  GRID_SPACING_Y: 5,    // ... and every GRID_SPACING_Y units in y
  COLLECTOR_SPEED: 0.4, // top speed of the collector, units per time step (agents move at up to 1)
  CAPTURE_RADIUS: 3,    // agents closer than this to the collector stick to it
  RELEASE_RADIUS: 25,   // stuck agents farther than this are released
  KEEP_CLOSE: 5,        // lag of the stuck group's centroid at which the collector stops
  FIELD_WEIGHT: 0.5,    // stuck agents home toward (1-w)*collector + w*nearest lattice target (unit vectors); 0 = ignore the field
  COLLECTOR_X0: 30,     // where the collector starts
  COLLECTOR_Y0: 0,
  FIELD_SPEED: 0.2,     // speed of the whole target field along its circle, units per time step (agents move at up to 1); negative = clockwise
  FIELD_RADIUS: 20,     // radius of the circle the field center moves on (0 = field stays put)
  TRAIL_LEN: 600,       // how many past positions of the collector are drawn
  POS_SEED: 2,          // same seeds the MATLAB script uses (rng(2), rng(18))
  ANG_SEED: 18,
};

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// small seeded PRNG (mulberry32) so a Reset reproduces the same initial condition
function mulberry32(seed) {
  let a = (seed >>> 0) + 0x6D2B79F5;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* transition.m, 'expReciprocal': smooth step, 1 at x=0 and exactly 0 for x>=1 */
function expReciprocal(x) {
  if (x >= 1) return 0;
  const a = Math.exp(-1 / (1 - x));
  const b = Math.exp(-1 / x);        // x = 0 -> exp(-Infinity) = 0 -> result 1
  return a / (b + a);
}

/* ---------- Delaunay triangulation (Bowyer-Watson) ----------
   Returns nbr[i] = array of Delaunay neighbors of point i.
   X is a flat [x0,y0,x1,y1,...] array of N points. */
function delaunayNeighbors(X, N) {
  const nbr = new Array(N);
  for (let i = 0; i < N; i++) nbr[i] = [];
  if (N < 2) return nbr;

  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (let i = 0; i < N; i++) {
    const x = X[2 * i], y = X[2 * i + 1];
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const ox = (minx + maxx) / 2, oy = (miny + maxy) / 2;
  const ext = Math.max(maxx - minx, maxy - miny, 1);
  const D = 60 * ext;                       // super-triangle size

  const P = new Float64Array(2 * (N + 3));
  for (let i = 0; i < N; i++) { P[2 * i] = X[2 * i] - ox; P[2 * i + 1] = X[2 * i + 1] - oy; }
  P[2 * N] = 0;       P[2 * N + 1] = 3 * D;
  P[2 * N + 2] = -3 * D; P[2 * N + 3] = -3 * D;
  P[2 * N + 4] = 3 * D;  P[2 * N + 5] = -3 * D;

  const makeTri = (a, b, c) => {
    const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], cx = P[2 * c], cy = P[2 * c + 1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-300) return { a, b, c, x: 0, y: 0, r2: 0 };   // degenerate: never "contains" anything
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    const dx = ax - ux, dy = ay - uy;
    return { a, b, c, x: ux, y: uy, r2: dx * dx + dy * dy };
  };

  let tris = [makeTri(N, N + 1, N + 2)];
  const M = N + 3;
  for (let p = 0; p < N; p++) {
    const px = P[2 * p], py = P[2 * p + 1];
    const keep = [];
    const edgeCount = new Map();
    const addEdge = (u, v) => {
      const k = u < v ? u * M + v : v * M + u;
      const e = edgeCount.get(k);
      if (e) e.n++; else edgeCount.set(k, { u, v, n: 1 });
    };
    for (let t = 0; t < tris.length; t++) {
      const T = tris[t];
      const dx = px - T.x, dy = py - T.y;
      if (dx * dx + dy * dy < T.r2) { addEdge(T.a, T.b); addEdge(T.b, T.c); addEdge(T.c, T.a); }
      else keep.push(T);
    }
    for (const e of edgeCount.values()) if (e.n === 1) keep.push(makeTri(e.u, e.v, p));
    tris = keep;
  }

  const link = (i, j) => { if (nbr[i].indexOf(j) < 0) nbr[i].push(j); if (nbr[j].indexOf(i) < 0) nbr[j].push(i); };
  for (const T of tris) {
    if (T.a >= N || T.b >= N || T.c >= N) continue;   // drop triangles touching the super-triangle
    link(T.a, T.b); link(T.b, T.c); link(T.c, T.a);
  }
  return nbr;
}

class VTPSim {
  constructor(canvas, N = PARAMS.N_DEFAULT) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;

    // ---- live-editable parameters ----
    this.nu = PARAMS.NU_DEFAULT;
    this.L = PARAMS.L;
    this.gridHalf = PARAMS.GRID_HALF;
    this.gridSpacingX = PARAMS.GRID_SPACING_X;
    this.gridSpacingY = PARAMS.GRID_SPACING_Y;
    this.collectorSpeed = PARAMS.COLLECTOR_SPEED;
    this.captureRadius = PARAMS.CAPTURE_RADIUS;
    this.releaseRadius = PARAMS.RELEASE_RADIUS;
    this.keepClose = PARAMS.KEEP_CLOSE;
    this.fieldWeight = PARAMS.FIELD_WEIGHT;
    this.startX = PARAMS.COLLECTOR_X0;
    this.startY = PARAMS.COLLECTOR_Y0;
    this.colX = this.startX; this.colY = this.startY;
    this.nStuck = 0;
    this.fieldSpeed = PARAMS.FIELD_SPEED;
    this.fieldRadius = PARAMS.FIELD_RADIUS;
    this.fieldTheta = 0;               // angle of the field center on its circle (radians)
    this.offX = 0; this.offY = 0;      // current position of the field center (= offset of the whole field)
    this.trail = [];
    this.viewMode = "swarm";       // "swarm" (MATLAB: fixframe = false) | "world" (fixed at the origin) | "field" (follows the moving field)
    this.showHeadings = true;
    this.stepsPerFrame = 1;
    this.paused = false;
    this.cam = null;
    this.onSetupChange = null;

    this.buildLattice();
    this.setup(N);
  }

  /* static lattice: meshgrid(-gridHalf:spacingX:gridHalf, -gridHalf:spacingY:gridHalf) */
  buildLattice() {
    const H = this.gridHalf;
    const sx = Math.max(this.gridSpacingX, 0.25), sy = Math.max(this.gridSpacingY, 0.25);
    const nx = Math.floor((2 * H) / sx + 1e-9), ny = Math.floor((2 * H) / sy + 1e-9);
    this.spX = sx; this.spY = sy; this.cellsX = nx; this.cellsY = ny;
    const pts = new Float64Array(2 * (nx + 1) * (ny + 1));
    let k = 0;
    for (let iy = 0; iy <= ny; iy++)
      for (let ix = 0; ix <= nx; ix++) { pts[k++] = -H + ix * sx; pts[k++] = -H + iy * sy; }
    this.statics = pts;
    this.nStatic = (nx + 1) * (ny + 1);
  }

  /* angular velocity of the field on its circle, rad per step (speed = radius * omega) */
  fieldOmega() {
    return this.fieldRadius > 0 ? this.fieldSpeed / this.fieldRadius : 0;
  }

  /* place the field center on its circle */
  updateFieldOffset() {
    this.offX = this.fieldRadius * Math.cos(this.fieldTheta);
    this.offY = this.fieldRadius * Math.sin(this.fieldTheta);
  }

  /* put the collector back at its start position and release every agent */
  resetCollector() {
    this.colX = this.startX; this.colY = this.startY;
    if (!this.stuck || this.stuck.length !== this.N) this.stuck = new Uint8Array(this.N);
    else this.stuck.fill(0);
    this.nStuck = 0;
    this.trail = [];
  }

  /* collector: capture / release, then move (the top of one MATLAB loop iteration).
       stuck = (stuck & dist <= releaseRadius) | (dist <= captureRadius)
     Then it moves toward the nearest agent that is not stuck, at up to
     collectorSpeed * throttle, where throttle = max(0, 1 - lag/keepClose) and
     lag is how far the centroid of the stuck agents trails the collector. If every
     agent is stuck it moves to the centroid of the group and stays there. */
  updateCollector() {
    const N = this.N, X = this.X, stuck = this.stuck;
    const cx = this.colX, cy = this.colY;
    let n = 0, sx = 0, sy = 0, mx = 0, my = 0, bestD2 = Infinity, bi = -1;
    for (let i = 0; i < N; i++) {
      const x = X[2 * i], y = X[2 * i + 1];
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      const st = (stuck[i] === 1 && d <= this.releaseRadius) || d <= this.captureRadius;
      stuck[i] = st ? 1 : 0;
      mx += x; my += y;
      if (st) { n++; sx += x; sy += y; }
      else if (d2 < bestD2) { bestD2 = d2; bi = i; }
    }
    this.nStuck = n;
    let throttle = 1;
    if (n > 0) {
      const lag = Math.hypot(sx / n - cx, sy / n - cy);
      throttle = Math.max(0, 1 - lag / Math.max(this.keepClose, 1e-9));
    }
    let gx, gy;
    if (bi >= 0) { gx = X[2 * bi]; gy = X[2 * bi + 1]; }
    else { gx = mx / N; gy = my / N; }
    const vx = gx - cx, vy = gy - cy, dist = Math.hypot(vx, vy);
    if (dist > 0) {
      const step = Math.min(this.collectorSpeed * throttle, dist);
      this.colX = cx + (vx / dist) * step;
      this.colY = cy + (vy / dist) * step;
    }
  }

  /* new run. seeded = true reproduces the MATLAB-style fixed seeds. */
  setup(N, seeded = true) {
    this.N = N = Math.max(3, Math.round(N));
    const rngP = mulberry32(seeded ? PARAMS.POS_SEED : (Math.random() * 1e9) | 0);
    const rngA = mulberry32(seeded ? PARAMS.ANG_SEED : (Math.random() * 1e9) | 0);
    const icRad = 0.5 * Math.sqrt((N * Math.PI) / 4 / 0.91);
    this.X = new Float64Array(2 * N);
    this.U = new Float64Array(2 * N);     // velocity from the previous step (alignment uses its direction)
    this.U1 = new Float64Array(2 * N);    // desired direction this step (what MATLAB plots)
    this.Unext = new Float64Array(2 * N); // velocity applied at the next commit
    for (let i = 0; i < N; i++) {
      this.X[2 * i] = icRad * (2 * rngP() - 1);
      this.X[2 * i + 1] = icRad * (2 * rngP() - 1);
    }
    for (let i = 0; i < N; i++) {
      const ang = 2 * Math.PI * rngA();
      this.U[2 * i] = Math.cos(ang);
      this.U[2 * i + 1] = Math.sin(ang);
    }
    this.t = 1;                                   // MATLAB loop index of the displayed state
    this.fieldTheta = this.fieldOmega() * this.t; // field angle at step t is omega * t
    this.updateFieldOffset();
    this.cam = null;
    this.resetCollector();
    this.compute();
    if (this.onSetupChange) this.onSetupChange();
  }

  /* one MATLAB loop iteration up to (not including) the position update:
     moves the collector, then computes U1 (desired direction)
     and Unext (= tanh(l/L) * U1) for the current positions. */
  compute() {
    const N = this.N, X = this.X, L = this.L, nu = this.nu;
    this.updateCollector();
    const ox = this.colX, oy = this.colY;
    this.trail.push(ox, oy);
    if (this.trail.length > 2 * PARAMS.TRAIL_LEN) this.trail.splice(0, this.trail.length - 2 * PARAMS.TRAIL_LEN);

    const nbr = delaunayNeighbors(X, N);
    this.nbr = nbr;

    // nearest Delaunay neighbor + distance (neighborhoods.m)
    const s = new Float64Array(N);
    const rx = new Float64Array(N), ry = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let best = Infinity, bj = -1;
      for (const j of nbr[i]) {
        const dx = X[2 * i] - X[2 * j], dy = X[2 * i + 1] - X[2 * j + 1];
        const d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; bj = j; }
      }
      if (bj < 0) { s[i] = 0; continue; }
      const d = Math.sqrt(best);
      s[i] = expReciprocal(d / L);
      if (d > 0) {                         // repulsion: length s, pointing away from the nearest neighbor
        rx[i] = s[i] * (X[2 * i] - X[2 * bj]) / d;
        ry[i] = s[i] * (X[2 * i + 1] - X[2 * bj + 1]) / d;
      }
    }

    // normalized previous headings for alignment
    const nx = new Float64Array(N), ny = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(this.U[2 * i], this.U[2 * i + 1]);
      if (m > 0) { nx[i] = this.U[2 * i] / m; ny[i] = this.U[2 * i + 1] / m; }
    }

    for (let i = 0; i < N; i++) {
      // alignment (alignTo.m): sum of w(<ui,uj>) uj over Delaunay neighbors, times 1/6
      let ax = 0, ay = 0;
      for (const j of nbr[i]) {
        let dp = nx[i] * nx[j] + ny[i] * ny[j];
        if (dp > 1) dp = 1; else if (dp < -1) dp = -1;
        const w = expReciprocal(Math.acos(dp) / Math.PI);
        ax += w * nx[j]; ay += w * ny[j];
      }
      ax /= 6; ay /= 6;

      // homing: unit vector toward the target, length (1 - s)
      const px = X[2 * i], py = X[2 * i + 1];
      // nearest lattice point (the field): the lattice is rectangular, so round
      // each axis independently, in the frame that moves with the field
      const H = this.gridHalf, qx = px - this.offX, qy = py - this.offY;
      const ix = clamp(Math.round((qx + H) / this.spX), 0, this.cellsX);
      const iy = clamp(Math.round((qy + H) / this.spY), 0, this.cellsY);
      const fx = -H + ix * this.spX - qx, fy = -H + iy * this.spY - qy;   // toward the field
      const cxv = ox - px, cyv = oy - py;                                 // toward the collector
      const dF = Math.hypot(fx, fy), dC = Math.hypot(cxv, cyv);
      let hx, hy;
      if (this.stuck[i]) {
        // stuck agents keep feeling the field: blend of the two unit vectors
        const w = this.fieldWeight;
        hx = (dC > 0 ? (1 - w) * cxv / dC : 0) + (dF > 0 ? w * fx / dF : 0);
        hy = (dC > 0 ? (1 - w) * cyv / dC : 0) + (dF > 0 ? w * fy / dF : 0);
      } else if (dC < dF) { hx = cxv; hy = cyv; }   // free agents: nearest target (lattice or collector)
      else { hx = fx; hy = fy; }
      const hn = Math.hypot(hx, hy);
      if (hn > 0) { hx = ((1 - s[i]) * hx) / hn; hy = ((1 - s[i]) * hy) / hn; } else { hx = 0; hy = 0; }

      // direction
      const u1x = (rx[i] + hx + nu * ax) / (1 + nu);
      const u1y = (ry[i] + hy + nu * ay) / (1 + nu);
      this.U1[2 * i] = u1x; this.U1[2 * i + 1] = u1y;

      // speed governor: distance to the Voronoi cell boundary along u1.
      // The cell is the intersection of the half-planes toward each Delaunay
      // neighbor, so the exit distance is min over neighbors j with u.d_j > 0
      // of |d_j|^2 / (2 u.d_j). No such neighbor -> unbounded cell -> Infinity.
      let m = Math.hypot(u1x, u1y), ux = 1, uy = 0;
      if (m > 0) { ux = u1x / m; uy = u1y / m; }
      let l = Infinity;
      for (const j of nbr[i]) {
        const dx = X[2 * j] - px, dy = X[2 * j + 1] - py;
        const den = ux * dx + uy * dy;
        if (den > 1e-12) {
          const tt = (dx * dx + dy * dy) / (2 * den);
          if (tt < l) l = tt;
        }
      }
      const sp = Math.tanh(l / L);          // tanh(Infinity) = 1
      this.Unext[2 * i] = sp * u1x; this.Unext[2 * i + 1] = sp * u1y;
    }
  }

  /* apply the position update, advance time and the field, compute the next step */
  step() {
    const N = this.N;
    for (let i = 0; i < 2 * N; i++) { this.X[i] += this.Unext[i]; this.U[i] = this.Unext[i]; }
    this.t++;
    this.fieldTheta += this.fieldOmega();         // accumulates, so changing the speed live is smooth
    this.updateFieldOffset();
    this.compute();
  }

  updateCamera() {
    const N = this.N, X = this.X;
    let cx, cy, hw;
    if (this.viewMode === "swarm") {
      // MATLAB: frame = center of mass +/- 3 * median radius
      let mx = 0, my = 0;
      for (let i = 0; i < N; i++) { mx += X[2 * i]; my += X[2 * i + 1]; }
      mx /= N; my /= N;
      const r = new Array(N);
      for (let i = 0; i < N; i++) r[i] = Math.hypot(X[2 * i] - mx, X[2 * i + 1] - my);
      r.sort((a, b) => a - b);
      cx = mx; cy = my; hw = Math.max(3 * r[N >> 1], 4);
    } else {
      const following = this.viewMode === "field";
      cx = following ? this.offX : 0;
      cy = following ? this.offY : 0;
      hw = 1.15 * (this.gridHalf + (following ? 0 : this.fieldRadius)) + 2;
    }
    if (!this.cam) this.cam = { cx, cy, hw };
    const a = 0.08;
    this.cam.cx += (cx - this.cam.cx) * a;
    this.cam.cy += (cy - this.cam.cy) * a;
    this.cam.hw += (hw - this.cam.hw) * a;
  }

  draw() {
    const canvas = this.canvas, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.updateCamera();
    const { cx, cy, hw } = this.cam;
    const scale = Math.min(w, h) / (2 * hw);
    const toPx = (x, y) => [w / 2 + (x - cx) * scale, h / 2 - (y - cy) * scale];

    // recent trail of the collector
    {
      const tr = this.trail;
      if (tr.length >= 4) {
        ctx.strokeStyle = "rgba(242,104,95,0.40)"; ctx.lineWidth = 1;
        ctx.beginPath();
        let [qx, qy] = toPx(tr[0], tr[1]);
        ctx.moveTo(qx, qy);
        for (let k = 2; k < tr.length; k += 2) { [qx, qy] = toPx(tr[k], tr[k + 1]); ctx.lineTo(qx, qy); }
        ctx.stroke();
      }
    }

    // static lattice targets (only those inside the view)
    ctx.fillStyle = "#6b7280";
    const sq = clamp(0.35 * scale, 2, 7);
    const xlo = cx - w / (2 * scale) - 1, xhi = cx + w / (2 * scale) + 1;
    const ylo = cy - h / (2 * scale) - 1, yhi = cy + h / (2 * scale) + 1;
    for (let k = 0; k < this.nStatic; k++) {
      const gx = this.statics[2 * k] + this.offX, gy = this.statics[2 * k + 1] + this.offY;
      if (gx < xlo || gx > xhi || gy < ylo || gy > yhi) continue;
      const [px, py] = toPx(gx, gy);
      ctx.fillRect(px - sq / 2, py - sq / 2, sq, sq);
    }

    // collector: capture radius ring + marker
    {
      const [px, py] = toPx(this.colX, this.colY);
      ctx.strokeStyle = "rgba(242,104,95,0.6)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(px, py, Math.max(this.captureRadius * scale, 3), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(242,104,95,0.25)";
      ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f2685f";
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    }

    // agents
    const N = this.N;
    if (this.showHeadings) {
      ctx.strokeStyle = "#5aa4f2"; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
      for (let i = 0; i < N; i++) {
        const x0 = this.X[2 * i], y0 = this.X[2 * i + 1];
        const [px0, py0] = toPx(x0, y0);
        const [px1, py1] = toPx(x0 + this.U1[2 * i], y0 + this.U1[2 * i + 1]);
        ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (let pass = 0; pass < 2; pass++) {          // free agents white, stuck agents orange
      ctx.fillStyle = pass === 0 ? "#f4f5f7" : "#f5a33b";
      for (let i = 0; i < N; i++) {
        if ((this.stuck[i] === 1) !== (pass === 1)) continue;
        const [px, py] = toPx(this.X[2 * i], this.X[2 * i + 1]);
        ctx.beginPath(); ctx.arc(px, py, pass === 1 ? 2.6 : 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

if (typeof module !== "undefined") module.exports = { VTPSim, PARAMS, delaunayNeighbors, expReciprocal };
