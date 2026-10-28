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
const capSlider = $("capSlider"), capVal = $("capVal");
const relSlider = $("relSlider"), relVal = $("relVal");
const keepSlider = $("keepSlider"), keepVal = $("keepVal");
const fwSlider = $("fwSlider"), fwVal = $("fwVal");
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
  capVal.textContent = sim.captureRadius.toFixed(1);
  relVal.textContent = sim.releaseRadius.toFixed(0);
  keepVal.textContent = sim.keepClose.toFixed(1);
  fwVal.textContent = sim.fieldWeight.toFixed(2);
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
capSlider.addEventListener("input", () => { sim.captureRadius = +capSlider.value; showCollector(); });
relSlider.addEventListener("input", () => { sim.releaseRadius = +relSlider.value; showCollector(); });
keepSlider.addEventListener("input", () => { sim.keepClose = +keepSlider.value; showCollector(); });
fwSlider.addEventListener("input", () => { sim.fieldWeight = +fwSlider.value; showCollector(); });
/* moving the start sliders puts the collector back at that spot right away (and releases every agent) */
sxSlider.addEventListener("input", () => { sim.startX = +sxSlider.value; showCollector(); sim.resetCollector(); });
sySlider.addEventListener("input", () => { sim.startY = +sySlider.value; showCollector(); sim.resetCollector(); });

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
  sim.captureRadius = PARAMS.CAPTURE_RADIUS; setSlider(capSlider, sim.captureRadius);
  sim.releaseRadius = PARAMS.RELEASE_RADIUS; setSlider(relSlider, sim.releaseRadius);
  sim.keepClose = PARAMS.KEEP_CLOSE; setSlider(keepSlider, sim.keepClose);
  sim.fieldWeight = PARAMS.FIELD_WEIGHT; setSlider(fwSlider, sim.fieldWeight);
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
numAgents.addEventListener("change", () => sim.setup(+numAgents.value, true));

showFieldVel(); showCollector();
showStaticCount();

/* ---------- animation loop ---------- */
function loop() {
  if (!sim.paused) for (let k = 0; k < sim.stepsPerFrame; k++) sim.step();
  sim.draw();
  stuckInfo.textContent = `${sim.nStuck} of ${sim.N} agents stuck`;
  statusLine.textContent =
    `t = ${sim.t} | N = ${sim.N} | ${sim.nStatic} static targets + collector (${sim.nStuck} stuck) | ` +
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
