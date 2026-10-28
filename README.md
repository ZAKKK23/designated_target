# plane-vtp-target-field (Voronoi Topological Perception)

The VTP agent model on the plane with a **large lattice of static targets**
that **circles around the origin** and **one collector target** that goes after
the agents, picks them up and moves so as to keep them close, as a MATLAB model
and a dependency-free browser port of the same dynamics.

**[Live site →](#)** (enable GitHub Pages, see below)

## What it is

Agents follow the Voronoi Topological Perception (VTP) model:

- **Topological neighbors.** An agent's neighbors are its Delaunay-triangulation
  neighbors (the agents whose Voronoi cells touch its own).
- **Repulsion.** Away from the nearest neighbor, with magnitude
  *s* = transition(distance / L): 1 when touching, fading smoothly to exactly
  0 at distance L (`L = 1`).
- **Alignment.** With its Delaunay neighbors, weighted by **&nu;**. Neighbors
  whose heading already agrees with the agent's count for more.
- **Homing.** Toward the nearest target, with magnitude 1 &minus; *s*, so
  repulsion takes priority when an agent is crowded.
- **Speed governor.** Each agent moves at tanh(*l* / L) times its desired
  direction, where *l* is the distance to the boundary of its own Voronoi cell
  along its direction of motion. Crowded agents slow down; agents on the edge of
  the group have an unbounded cell and move at full speed.

### The target field

All targets are point targets, and each agent homes toward whichever one is
currently nearest to it, except agents stuck to the collector (below).

- **Static targets** form a rectangular lattice covering `[-H, H]^2`, with a
  spacing in x and a spacing in y that you choose independently (defaults:
  `H = 50`, spacing 5 in both, i.e. 441 targets).
- **The lattice goes around a circle.** It moves rigidly so that its center
  travels on a circle centered on the origin. You choose the **radius** `R` of
  the circle and the **speed** along it (units per time step; negative =
  clockwise). At time `t` the lattice center is at `R * (cos(theta), sin(theta))`
  with `theta = (speed / R) * t`, so one lap takes `2*pi*R / speed` steps.
  `R = 0` keeps the lattice still. Agents move at up to 1 unit per step, so a
  speed below about 1 can be followed.
- **One collector target**, which does not oscillate. It goes after the agents:
  - **Capture.** An agent that comes within `capture_radius` of the collector
    *sticks* to it. A stuck agent keeps feeling the target field: its homing
    direction is `(1 - field_weight)` times the unit vector to the collector
    plus `field_weight` times the unit vector to its nearest lattice target.
    That homing term then goes through the same VTP rules as every other
    agent (length 1 &minus; *s*, repulsion priority, alignment, Voronoi speed
    governor). `field_weight = 0` gives the old behaviour (stuck agents ignore
    the field), `1` makes them ignore the collector. It stays stuck until it
    drifts farther than `release_radius`, when it lets go (and can be
    captured again).
  - **Seeking.** The collector moves toward the nearest agent that is not stuck
    yet, at up to `collector_speed`. When every agent is stuck it moves to the
    centroid of the group and stays there.
  - **Keeping them close.** The collector slows down as the centroid of its
    stuck agents trails behind it: its speed factor is
    `max(0, 1 - lag / keep_close)`. It stops when the lag reaches `keep_close`,
    so it never runs off and leaves the agents it has collected behind, and it
    speeds up again as they catch up.

In the web version, the **view** menu has *follow swarm*, *fixed (world)* (the
camera stays at the origin so you can watch the lattice circle around it) and
*follow field*. Stuck agents are drawn in orange.

## Structure

```
index.html              site shell — tabs for about / live simulation / matlab version
assets/style.css        site styling
assets/sim.js           the VTP simulation engine (Delaunay neighbors, repulsion + alignment + homing, Voronoi speed governor, canvas rendering) — no external libraries
assets/app.js           page wiring — tabs, sliders, MATLAB source viewer
assets/matlab_src.json  bundled MATLAB source (for the in-page code viewer)
matlab/                 MATLAB implementation (dynamics.m and the files it depends on)
```

## Running the web version

No build step. Serve the folder (the MATLAB viewer tab loads
`assets/matlab_src.json` with `fetch`, which needs http rather than `file://`):

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/`. The live controls cover the number of
agents, &nu;, the lattice spacing in x and y and the half-width, the speed and
radius of the lattice's circular motion, and the collector's speed, capture
radius, release radius, keep-close distance, field weight of stuck agents and
start position.

## Running the MATLAB version

```
cd matlab
matlab -r dynamics
```

or open `matlab/dynamics.m` in the MATLAB editor and run it. The target-field
settings are at the top of the file:

```matlab
grid_half      = 50;     % static lattice covers [-grid_half, grid_half]^2
grid_spacing_x = 5;      % one static target every grid_spacing_x units in x
grid_spacing_y = 5;      % ... and every grid_spacing_y units in y

field_speed  = 0.2;      % speed of the lattice along its circle, units per time step (negative = clockwise)
field_radius = 20;       % radius of that circle (0 = lattice stays put)

collector_speed = 0.4;   % top speed of the collector, units per time step
capture_radius  = 3;     % agents closer than this stick to the collector
release_radius  = 25;    % stuck agents farther than this let go
keep_close      = 5;     % lag of the stuck group's centroid at which the collector stops
collector_start = [30 0];
field_weight    = 0.5;   % how much stuck agents still home toward the lattice (0 = collector only)
```

The lattice is plotted as grey squares, the collector as a red dot with its
capture radius dotted, and the agents stuck to it in orange. The collector's
capture-and-move step is at the start of the main loop in `dynamics.m`.
`matlab/` contains `dynamics.m` plus the files it depends on:
`Target.m`, `nearestOnSegment.m`, `neighborhoods.m`, `transition.m`,
`alignTo.m`, `voronoiProjectToBoundary.m`, and (only needed if you set
`fdim = 2`) `voronoiForwardArea.m` and `poly_area.m`. MATLAB needs the
functions these use for geometry (`delaunayTriangulation`, `voronoiDiagram`,
`polyxpoly`, `polyshape`).

## Publishing to GitHub Pages

1. Create a new GitHub repository and push this folder to it (see commands
   below).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`.
4. Save — the site will be published at
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Note on the JS port

The browser port implements the same VTP model as `dynamics.m` (with
`fdim = 1`, the default):

- The Delaunay triangulation is a small built-in Bowyer–Watson implementation.
  On a test configuration of 400 agents it produced exactly the same neighbor
  sets as SciPy's Delaunay.
- The speed governor is computed from the Delaunay neighbors rather than by
  intersecting a ray with the Voronoi polygon. A Voronoi cell is the
  intersection of the half-planes toward each Delaunay neighbor, so the
  distance to the boundary along a direction is the minimum of
  |d|² / (2 u·d) over neighbors with u·d > 0, and an unbounded cell gives
  tanh(∞) = 1. This is the same quantity `voronoiProjectToBoundary.m` returns.
  Repulsion, alignment, homing and the speed governor for one step matched an
  independent NumPy/SciPy implementation to machine precision.
- Initial conditions use a seeded generator with the same seeds as the MATLAB
  script (2 and 18), but MATLAB's `rng` cannot be reproduced in JavaScript, so
  the exact starting positions (and therefore trajectories) differ from
  MATLAB's. The behavior is statistically the same.
- The nearest static target is found by rounding the agent's position, taken
  in the frame that moves with the lattice, to the rectangular lattice (exact, and much faster than scanning every lattice point).
  I checked it against a brute-force scan on 2000 random points with zero
  mismatches.
- In MATLAB the `Target` object is rebuilt every step (the lattice and the
  collector both move), which replaces the single `setComponent` call used before.
- Only `fdim = 1` is ported; the forward-area speed option (`fdim = 2`) is
  MATLAB-only.
- The MATLAB script was not run in MATLAB while it was being written.
