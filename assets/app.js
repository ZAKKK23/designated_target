/* ===========================================================
   plane-vtp-target-field — page glue
   =========================================================== */

/* ---------- tabs ---------- */
const tabButtons = document.querySelectorAll("nav.tabs button");
const views = document.querySelectorAll(".view");
function showView(name) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  views.forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
}
tabButtons.forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
window.addEventListener("hashchange", () => {
  const h = location.hash.replace("#", "");
  if (h) showView(h);
});
if (location.hash) showView(location.hash.replace("#", ""));

/* ---------- simulation wiring ---------- */
const canvas = document.getElementById("simCanvas");
const sim = new VTPSim(canvas, PARAMS.N_DEFAULT);

const $ = (id) => document.getElementById(id);
const statusLine = $("statusLine");
const numAgents = $("numAgents");
const spfSlider = $("spfSlider"), spfVal = $("spfVal");
const viewSelect = $("viewSelect"), headingsCb = $("headingsCb");
const nuSlider = $("nuSlider"), nuVal = $("nuVal");
const spXSlider = $("spXSlider"), spXVal = $("spXVal");
const spYSlider = $("spYSlider"), spYVal = $("spYVal");
const halfSlider = $("halfSlider"), halfVal = $("halfVal");
const staticCount = $("staticCount");
const fsSlider = $("fsSlider"), fsVal = $("fsVal");
const frSlider = $("frSlider"), frVal = $("frVal");
const fieldVelInfo = $("fieldVelInfo");
const csSlider = $("csSlider"), csVal = $("csVal");
const atSlider = $("atSlider"), atVal = $("atVal");
const nzSlider = $("nzSlider"), nzVal = $("nzVal"), noiseInfo = $("noiseInfo");
const sxSlider = $("sxSlider"), sxVal = $("sxVal");
const sySlider = $("sySlider"), syVal = $("syVal");
const stuckInfo = $("stuckInfo");
const btnPause = $("btnPause"), btnReset = $("btnReset"), btnRandom = $("btnRandom");

function showStaticCount() {
  staticCount.textContent = `${sim.nStatic} static targets`;
}
function rebuildLattice() {
  sim.buildLattice();
  showStaticCount();
}
function showFieldVel() {
  fsVal.textContent = sim.fieldSpeed.toFixed(2);
  frVal.textContent = sim.fieldRadius.toFixed(1);
  const w = sim.fieldOmega();
  if (w === 0) { fieldVelInfo.textContent = sim.fieldRadius > 0 ? "field still (speed 0)" : "field still (radius 0)"; return; }
  fieldVelInfo.textContent = `period ${(2 * Math.PI / Math.abs(w)).toFixed(0)} steps, ${w > 0 ? "counter-clockwise" : "clockwise"}`;
}
function showCollector() {
  csVal.textContent = sim.collectorSpeed.toFixed(2);
  atVal.textContent = String(sim.attachSteps);
  sxVal.textContent = sim.startX.toFixed(0);
  syVal.textContent = sim.startY.toFixed(0);
}

spfSlider.addEventListener("input", () => { sim.stepsPerFrame = +spfSlider.value; spfVal.textContent = spfSlider.value; });
viewSelect.addEventListener("change", () => { sim.viewMode = viewSelect.value; });
headingsCb.addEventListener("change", () => { sim.showHeadings = headingsCb.checked; });
nuSlider.addEventListener("input", () => { sim.nu = +nuSlider.value; nuVal.textContent = sim.nu.toFixed(2); });

spXSlider.addEventListener("input", () => { sim.gridSpacingX = +spXSlider.value; spXVal.textContent = sim.gridSpacingX.toFixed(1); rebuildLattice(); });
spYSlider.addEventListener("input", () => { sim.gridSpacingY = +spYSlider.value; spYVal.textContent = sim.gridSpacingY.toFixed(1); rebuildLattice(); });
halfSlider.addEventListener("input", () => { sim.gridHalf = +halfSlider.value; halfVal.textContent = String(sim.gridHalf); rebuildLattice(); });
fsSlider.addEventListener("input", () => { sim.fieldSpeed = +fsSlider.value; showFieldVel(); });
frSlider.addEventListener("input", () => { sim.fieldRadius = +frSlider.value; sim.updateFieldOffset(); showFieldVel(); });

csSlider.addEventListener("input", () => { sim.collectorSpeed = +csSlider.value; showCollector(); });
atSlider.addEventListener("input", () => { sim.attachSteps = +atSlider.value; showCollector(); });
nzSlider.addEventListener("input", () => { sim.noiseRate = +nzSlider.value; nzVal.textContent = sim.noiseRate.toFixed(3); });
/* moving the start sliders puts the collector back at that spot right away (and releases every agent) */
sxSlider.addEventListener("input", () => { sim.startX = +sxSlider.value; showCollector(); sim.resetCollector(); clearStuckHistory(); });
sySlider.addEventListener("input", () => { sim.startY = +sySlider.value; showCollector(); sim.resetCollector(); clearStuckHistory(); });

btnPause.addEventListener("click", () => {
  sim.paused = !sim.paused;
  btnPause.textContent = sim.paused ? "Resume" : "Pause";
});

function setSlider(slider, value) { slider.value = value; }
function restoreDefaults() {
  sim.nu = PARAMS.NU_DEFAULT; setSlider(nuSlider, sim.nu); nuVal.textContent = sim.nu.toFixed(2);
  sim.gridSpacingX = PARAMS.GRID_SPACING_X; setSlider(spXSlider, sim.gridSpacingX); spXVal.textContent = sim.gridSpacingX.toFixed(1);
  sim.gridSpacingY = PARAMS.GRID_SPACING_Y; setSlider(spYSlider, sim.gridSpacingY); spYVal.textContent = sim.gridSpacingY.toFixed(1);
  sim.gridHalf = PARAMS.GRID_HALF; setSlider(halfSlider, sim.gridHalf); halfVal.textContent = String(sim.gridHalf);
  sim.fieldSpeed = PARAMS.FIELD_SPEED; setSlider(fsSlider, sim.fieldSpeed);
  sim.fieldRadius = PARAMS.FIELD_RADIUS; setSlider(frSlider, sim.fieldRadius);
  sim.collectorSpeed = PARAMS.COLLECTOR_SPEED; setSlider(csSlider, sim.collectorSpeed);
  sim.attachSteps = PARAMS.ATTACH_STEPS; setSlider(atSlider, sim.attachSteps);
  sim.noiseRate = PARAMS.NOISE_RATE; setSlider(nzSlider, sim.noiseRate); nzVal.textContent = sim.noiseRate.toFixed(3);
  sim.startX = PARAMS.COLLECTOR_X0; setSlider(sxSlider, sim.startX);
  sim.startY = PARAMS.COLLECTOR_Y0; setSlider(sySlider, sim.startY);
  showFieldVel(); showCollector();
  rebuildLattice();
}
btnReset.addEventListener("click", () => {
  restoreDefaults();
  sim.setup(+numAgents.value, true);
});
btnRandom.addEventListener("click", () => sim.setup(+numAgents.value, false));
/* a new run (or a collector reset from the start sliders) clears the attached-agents chart */
sim.onSetupChange = () => clearStuckHistory();
numAgents.addEventListener("change", () => sim.setup(+numAgents.value, true));

showFieldVel(); showCollector();
showStaticCount();

/* ---------- attached-agents chart: sim.nStuck vs time ---------- */
const STUCK_WINDOW = 3000; // how many recent steps the chart shows
const stuckChart = $("stuckChart"), stuckCtx = stuckChart.getContext("2d");
const stuckChartNow = $("stuckChartNow"), stuckChartTip = $("stuckChartTip");
let stuckT = [], stuckN = [], stuckHover = null;
/* the first EXPORT_STEPS steps of the run are kept separately for export */
const EXPORT_STEPS = 5000;
let firstT = [], firstN = [];
function clearStuckHistory() { stuckT = []; stuckN = []; firstT = []; firstN = []; recordStuck(); }
function recordStuck() {
  if (stuckT.length && stuckT[stuckT.length - 1] === sim.t) return;
  stuckT.push(sim.t); stuckN.push(sim.nStuck);
  if (sim.t <= EXPORT_STEPS) { firstT.push(sim.t); firstN.push(sim.nStuck); }
  if (stuckT.length > STUCK_WINDOW) { stuckT.splice(0, stuckT.length - STUCK_WINDOW); stuckN.splice(0, stuckN.length - STUCK_WINDOW); }
}
const SC_PAD = { l: 34, r: 8, t: 6, b: 18 };
function stuckScales(w, h) {
  let peak = 0;
  for (const n of stuckN) if (n > peak) peak = n;
  const yMax = Math.max(10, Math.ceil((peak * 1.15) / 10) * 10);
  const t0 = stuckT[0], t1 = Math.max(stuckT[stuckT.length - 1], t0 + 1);
  const pw = w - SC_PAD.l - SC_PAD.r, ph = h - SC_PAD.t - SC_PAD.b;
  return { yMax, t0, t1, peak,
    X: (t) => SC_PAD.l + ((t - t0) / (t1 - t0)) * pw,
    Y: (n) => SC_PAD.t + ph - (n / yMax) * ph };
}
function drawStuckChart() {
  const dpr = window.devicePixelRatio || 1;
  const w = stuckChart.clientWidth, h = stuckChart.clientHeight;
  if (!w || !h) return;
  if (stuckChart.width !== Math.round(w * dpr) || stuckChart.height !== Math.round(h * dpr)) {
    stuckChart.width = Math.round(w * dpr); stuckChart.height = Math.round(h * dpr);
  }
  const ctx = stuckCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  stuckChartNow.textContent = `now ${sim.nStuck} of ${sim.N} (${(100 * sim.nStuck / sim.N).toFixed(1)}%)`;
  if (!stuckT.length) return;
  const { yMax, t0, t1, peak, X, Y } = stuckScales(w, h);
  ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
  ctx.textBaseline = "middle";
  // recessive grid + y ticks (0, half, max)
  ctx.strokeStyle = "#1c1f29"; ctx.fillStyle = "#7b8394"; ctx.lineWidth = 1; ctx.textAlign = "right";
  for (const v of [0, yMax / 2, yMax]) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(SC_PAD.l, y); ctx.lineTo(w - SC_PAD.r, y); ctx.stroke();
    ctx.fillText(String(v), SC_PAD.l - 5, y);
  }
  // x labels: first and last step shown
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillText(`t = ${t0}`, SC_PAD.l, h - 4);
  ctx.textAlign = "right"; ctx.fillText(`t = ${t1}`, w - SC_PAD.r, h - 4);
  // area + line (same orange as stuck agents on the main canvas)
  ctx.beginPath();
  ctx.moveTo(X(stuckT[0]), Y(stuckN[0]));
  for (let k = 1; k < stuckT.length; k++) ctx.lineTo(X(stuckT[k]), Y(stuckN[k]));
  ctx.strokeStyle = "#f5a33b"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  ctx.lineTo(X(stuckT[stuckT.length - 1]), Y(0)); ctx.lineTo(X(stuckT[0]), Y(0)); ctx.closePath();
  ctx.fillStyle = "rgba(245,163,59,0.12)"; ctx.fill();
  // peak marker label
  if (peak > 0) {
    const k = stuckN.indexOf(peak);
    ctx.fillStyle = "#7b8394"; ctx.textAlign = X(stuckT[k]) > w - 80 ? "right" : "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`peak ${peak}`, X(stuckT[k]) + (ctx.textAlign === "left" ? 4 : -4), Y(peak) - 2);
  }
  // hover crosshair + tooltip
  if (stuckHover !== null) {
    const tH = t0 + ((stuckHover - SC_PAD.l) / (w - SC_PAD.l - SC_PAD.r)) * (t1 - t0);
    let k = 0, best = Infinity;
    for (let j = 0; j < stuckT.length; j++) { const d = Math.abs(stuckT[j] - tH); if (d < best) { best = d; k = j; } }
    const px = X(stuckT[k]), py = Y(stuckN[k]);
    ctx.strokeStyle = "#7b8394"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, SC_PAD.t); ctx.lineTo(Math.round(px) + 0.5, Y(0)); ctx.stroke();
    ctx.fillStyle = "#05060a"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f5a33b"; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    stuckChartTip.textContent = `t = ${stuckT[k]}: ${stuckN[k]} attached`;
    stuckChartTip.style.display = "block";
    const tw = stuckChartTip.offsetWidth;
    stuckChartTip.style.left = Math.min(Math.max(px + 8, 0), w - tw) + "px";
  } else stuckChartTip.style.display = "none";
}
/* ---------- export the first EXPORT_STEPS steps as a PNG image ---------- */
const btnExportPng = $("btnExportPng");
function exportReady() { return firstT.length && firstT[firstT.length - 1] >= EXPORT_STEPS; }
function showExportState() {
  const ready = exportReady();
  btnExportPng.disabled = !ready;
  const done = firstT.length ? Math.min(firstT[firstT.length - 1], EXPORT_STEPS) : 0;
  btnExportPng.textContent = ready ? `Export first ${EXPORT_STEPS} steps (PNG)` : `Export at t = ${EXPORT_STEPS} (${done}/${EXPORT_STEPS})`;
}
function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportName(ext) { return `attached_first${EXPORT_STEPS}_N${sim.N}.${ext}`; }
btnExportPng.addEventListener("click", () => {
  if (!exportReady()) return;
  const W = 1600, Hh = 600, pad = { l: 80, r: 30, t: 60, b: 70 };
  const c = document.createElement("canvas"); c.width = W; c.height = Hh;
  const ctx = c.getContext("2d");
  const mono = getComputedStyle(document.body).getPropertyValue("--mono") || "monospace";
  ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, Hh);
  let peak = 0; for (const n of firstN) if (n > peak) peak = n;
  const yMax = Math.max(10, Math.ceil((peak * 1.15) / 10) * 10);
  const t0 = firstT[0], t1 = EXPORT_STEPS;
  const pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
  const X = (t) => pad.l + ((t - t0) / (t1 - t0)) * pw, Y = (n) => pad.t + ph - (n / yMax) * ph;
  ctx.fillStyle = "#dfe3ea"; ctx.font = "bold 22px " + mono; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(`Agents attached to the collector, first ${EXPORT_STEPS} steps (N = ${sim.N})`, pad.l, 36);
  ctx.font = "16px " + mono; ctx.strokeStyle = "#1c1f29"; ctx.lineWidth = 1;
  ctx.fillStyle = "#7b8394"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let k = 0; k <= 4; k++) {
    const v = (yMax * k) / 4, y = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(String(+v.toFixed(1)), pad.l - 10, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let k = 0; k <= 5; k++) { const t = k === 0 ? t0 : (EXPORT_STEPS * k) / 5; ctx.fillText(String(t), X(t), Hh - pad.b + 10); }
  ctx.fillText("time step t", pad.l + pw / 2, Hh - pad.b + 36);
  ctx.beginPath(); ctx.moveTo(X(firstT[0]), Y(firstN[0]));
  for (let k = 1; k < firstT.length; k++) ctx.lineTo(X(firstT[k]), Y(firstN[k]));
  ctx.strokeStyle = "#f5a33b"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
  ctx.lineTo(X(firstT[firstT.length - 1]), Y(0)); ctx.lineTo(X(firstT[0]), Y(0)); ctx.closePath();
  ctx.fillStyle = "rgba(245,163,59,0.12)"; ctx.fill();
  const kp = firstN.indexOf(peak);
  ctx.fillStyle = "#7b8394"; ctx.textAlign = X(firstT[kp]) > W - 200 ? "right" : "left"; ctx.textBaseline = "bottom";
  ctx.fillText(`peak ${peak} at t = ${firstT[kp]}`, X(firstT[kp]) + (ctx.textAlign === "left" ? 6 : -6), Y(peak) - 4);
  c.toBlob((b) => saveBlob(b, exportName("png")), "image/png");
});

stuckChart.addEventListener("mousemove", (e) => { stuckHover = e.clientX - stuckChart.getBoundingClientRect().left; if (sim.paused) drawStuckChart(); });
stuckChart.addEventListener("mouseleave", () => { stuckHover = null; if (sim.paused) drawStuckChart(); });
recordStuck();

/* ---------- animation loop ---------- */
function loop() {
  if (!sim.paused) for (let k = 0; k < sim.stepsPerFrame; k++) { sim.step(); recordStuck(); }
  sim.draw();
  drawStuckChart();
  showExportState();
  stuckInfo.textContent = `${sim.nStuck} of ${sim.N} agents attached`;
  noiseInfo.textContent = sim.noisy
    ? `burst: all agents homing at ${((sim.noiseAngle * 180) / Math.PI).toFixed(0)}°`
    : `${sim.noiseSteps}-step bursts, same homing angle for all agents`;
  statusLine.textContent =
    `t = ${sim.t} | N = ${sim.N} | ${sim.nStatic} static targets + collector (${sim.nStuck} attached, ${sim.attachSteps} steps) | ` +
    `collector v = ${sim.collectorSpeed.toFixed(2)} | field v = ${sim.fieldSpeed.toFixed(2)}, R = ${sim.fieldRadius.toFixed(1)} | \u03bd = ${sim.nu.toFixed(2)}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- matlab file viewer ---------- */
const FILE_NOTES = {
  "dynamics.m": "Main script. Target-field settings (lattice spacing in x and y, field circular-motion speed and radius, collector speed / capture / release / keep-close, field weight of stuck agents) are at the top; the collector's capture and move step is at the start of the loop; then the VTP loop: Delaunay neighbors, repulsion + alignment + homing, Voronoi speed governor.",
  "Target.m": "Target class: target geometry and the homeToTarget homing-vector method. The lattice and the collector are point components of one Target object.",
  "nearestOnSegment.m": "Geometry helper used internally by Target.m for segment-shaped targets.",
  "neighborhoods.m": "Delaunay-graph neighbors of every agent, plus each agent's nearest neighbor and its distance.",
  "transition.m": "Smooth cutoff functions (the model uses 'expReciprocal'): 1 at 0, exactly 0 from 1 onward.",
  "alignTo.m": "Alignment term: Delaunay neighbors' headings weighted by how well they agree with the agent's own.",
  "voronoiProjectToBoundary.m": "Distance from each agent to its Voronoi cell boundary along its direction of motion (the speed governor).",
  "voronoiForwardArea.m": "Forward Voronoi area, used only when fdim = 2 in dynamics.m.",
  "poly_area.m": "Polygon area helper used by voronoiForwardArea.m.",
};
const FILE_ORDER = ["dynamics.m", "Target.m", "nearestOnSegment.m", "neighborhoods.m", "transition.m", "alignTo.m", "voronoiProjectToBoundary.m", "voronoiForwardArea.m", "poly_area.m"];

const fileList = $("fileList");
const codeView = $("codeView");
const fileHint = $("fileHint");
let MATLAB_SRC = null;

async function loadMatlabSource() {
  try {
    const res = await fetch("assets/matlab_src.json");
    MATLAB_SRC = await res.json();
  } catch (e) {
    MATLAB_SRC = null;
    codeView.textContent = "Could not load assets/matlab_src.json (serve the folder over http, e.g. python3 -m http.server).";
    return;
  }
  let first = true;
  FILE_ORDER.forEach((name) => {
    if (!(name in MATLAB_SRC)) return;
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.addEventListener("click", () => selectFile(name));
    fileList.appendChild(btn);
    if (first) { selectFile(name); first = false; }
  });
}
function selectFile(name) {
  [...fileList.children].forEach((b) => b.classList.toggle("active", b.textContent === name));
  codeView.textContent = MATLAB_SRC[name];
  fileHint.textContent = FILE_NOTES[name] || "";
}
loadMatlabSource();
