<div align="center">

![RailSyn — Three robots. Three distinct jobs. One coordinated rail line.](docs/images/banner.svg)

[![Quick start](https://img.shields.io/badge/Quick_start-173D59?style=for-the-badge)](#quick-start)
[![Controller workflow](https://img.shields.io/badge/Controller_workflow-173D59?style=for-the-badge)](#controller-workflow)
[![Architecture](https://img.shields.io/badge/Architecture-173D59?style=for-the-badge)](#architecture)
[![Documentation](https://img.shields.io/badge/Documentation-176B70?style=for-the-badge)](#documentation)

</div>

---

## Overview

**RailSyn** is an interactive assembly simulator for operator-selected products, distinct robot jobs, and sensor-aware rail handoffs. Select the exact workpiece, first cap and top cover; watch their identities follow the product through setup, assembly, inspection and dispatch.

**Trial 2** introduces an original procedural 3D cell, a branched rectangular rail, specialized tools, a unified controller and an interactive explanation workspace. **Trial 1** remains independently runnable for comparison.

| | Trial 1 · preserved baseline | Trial 2 · current experiment |
|---|---|---|
| Docker address | [127.0.0.1:8640](http://127.0.0.1:8640) | [127.0.0.1:8641](http://127.0.0.1:8641) |
| Compose project | `railsyn` | `railsyn-trial2` |
| Start | `docker compose up -d --build` | `docker compose -f compose.trial2.yaml up -d --build` |
| Robot jobs | Body loading, first cap, cover fitting | FANUC tray handling, operator loading, UR3e cap/cover assembly, UR10 dispatch |
| Rail | Rectangular return loop | Rectangular main loop and lower setup branch |
| Interface | Original baseline controller | One Run in the right controller; native explanation tabs |
| Source | `src/`, `public/` | `trial2/` |
| Baseline revision | Tag / branch `trial-1`, commit `53901bd` | Added alongside baseline; no shared runtime mutation |

> **Research prototype · v0.6.7.** Geometry, kinematics, sensing and vision are modeled approximations. Physical robot output is disabled. Mixed recipes do not establish real mechanical compatibility.

## Quick start

**Requirements:** Docker Desktop and Git. Nothing else. No Node.js, npm, API key or paid service. This is a public repository, so anyone can clone and run it on Windows, macOS or Linux with the steps below.

Docker Desktop must be running with Linux containers enabled.

```sh
git clone https://github.com/Foysal-A-Al/railsyn.git
cd railsyn
docker compose -f compose.trial2.yaml up -d --build
```

Open **[RailSyn Trial 2](http://127.0.0.1:8641)** on the computer running Docker. Starting the container leaves the cell idle.

```sh
docker compose -f compose.trial2.yaml ps
docker compose -f compose.trial2.yaml logs --tail=50 app
docker compose -f compose.trial2.yaml stop
```

To run Trial 1 as well, use `docker compose up -d`. The two services use separate ports, images, processes and in-memory state. Updating Trial 2 does not require restarting Trial 1.

On Windows, `Start-Trial2.cmd` builds and opens the dedicated Docker service.

For native execution with Node.js 22 or later:

```sh
node trial2/server.mjs
```

Trial 2 uses port **8641**. Existing Trial 1 commands, `npm start` and `start.cmd`, retain native port **8630**. See the [Trial 2 guide](docs/trial2.md) for lifecycle and verification commands.

## Controller workflow

1. Choose a **B** workpiece, **C** first cap and **T** top cover from the left trays or the 3D scene. Any in-stock combination is accepted.
2. Review the exact IDs and finished-product rack destination in the **right controller**.
3. **Add recipe** stages a selection. Add up to four recipes and press **Start queue**.
4. At each setup stop, press **Place workpiece**, then **Resume queue** to release the shuttle for assembly.
5. The product remains in the output rack. The queue advances after the empty tray returns.

Recipes run in the selected order and stop for manual loading. Trial 2 currently has one active shuttle, S1; S2 and S3 are parked off the live rail.

| Control | Behavior |
|---|---|
| Robot tabs | Select FANUC, UR3e or UR10 to inspect its tool, joints and TCP |
| Run / Resume | Execute the chosen job or continue a paused one |
| Pause / Step stage | Hold motion or advance one gated process stage |
| Manual / drives / jog | Operate bounded concept joint increments with empty tools |
| Recover | Restore the saved pose before manual changes, preserving the paused job |
| SIM STOP / Clear stop | Latch a simulation stop; acknowledgement never restarts motion |
| Fault scenarios | Demonstrate missing grip, vision failure, blocked output, vibration settling and heartbeat loss |
| Reset trial | Explicitly replenish stock, clear products and return to the initial state |
| Export run | Download the current state and source identities as JSON |

Manual controls are illustrative, and **SIM STOP is not a physical emergency stop**.

## Trial 2 assembly line

| Station / cell | Responsibility | Modeled tool or mechanism |
|---|---|---|
| FANUC ER-4iA · station 6 | Load an empty tray and return it after dispatch | SCHUNK-style rectangular two-jaw gripper |
| Manual loading · branch station 9 | Position the selected workpiece in the tray nest | Fixed nest on the shuttle pallet |
| UR3e · station 4 | Pick the first cap and top cover sequentially | OnRobot-style adaptive two-finger gripper |
| Vision · station 8 | Gate dispatch on modeled assembly/quality state | Camera portal and synthetic confirmation |
| UR10 · station 8 | Move the complete assembly to a reserved output pocket | Robotiq-style articulated three-finger gripper |
| Rail return | Return S1 and its empty tray to the loading cell | Continuous main-loop route |

Station numbers and assignments describe this experiment. They do not claim to reproduce the lab's undocumented PLC program. Trial 2 models the loading operator and builds the station views from 3D geometry. It embeds no reference photographs or slides.

## Architecture

A standard-library Node.js server owns authoritative simulation state. The browser renders that state with bundled Three.js, the shared Blender robot meshes and procedural station geometry. Shared route coordinates and concept FK/IK keep rendering and process targets aligned.

| Layer | Trial 2 files | Responsibility |
|---|---|---|
| Process engine | `trial2/cell.mjs`, `trial2/public/cell-core.mjs` | Gated sequence, source stock, robot targets, stops, recovery and dispatch |
| Shared model | `trial2/public/model.mjs`, `kinematics.mjs` | Parts, dock positions, rail routes and concept kinematics |
| Local API | `trial2/server.mjs` | Origin/token checks, bounded commands and static-file allowlist |
| Workbench | `trial2/public/app.js`, `index.html`, `style.css` | Explicit selection and one controller |
| Original 3D | `trial2/public/scene.mjs` | Distinct articulated robots/tools, machinery, lighting and retained products |
| Explanation | `trial2/public/guide.mjs`, `engineering.mjs` | Route preview, command and handoff diagrams, and live response monitor |
| Isolated speed study | `trial2/public/study-worker.mjs`, `cell-core.mjs` | Seven simulated speed candidates evaluated without changing the Workbench state |
| Deployment | `Dockerfile.trial2`, `compose.trial2.yaml` | Separate non-root, read-only container on loopback port 8641 |
| Verification | `trial2/tests/` | Process, API and optional isolated-browser checks |

**How it works** covers production flow, robot and tool roles, control and handoffs, live system responses, and an isolated optimization study. The study compares makespan, simulated throughput, waiting, and optional estimates from user-supplied power assumptions. The grid search uses the same cell model as the Workbench. NSGA-II, calibrated energy and multi-shuttle optimization remain research extensions.

All state is **in memory**. Container restarts and Reset clear stock changes and finished products. Export snapshots before closing when you need a record. The two trials share bundled vendor modules, Blender robot meshes and an HDR lighting asset. The optional external measurement bridge belongs to Trial 1; Trial 2 does not yet accept external sensor packets or control real robots.

## Verification

Trial 2 passed **18 process/API tests** in a network-disabled, read-only Docker test container. They cover exact mixed recipes, distinct owners, continuous branch travel, manual loading, four ordered recipes, single stock consumption, faults, stop latching, Apply without motion, paused-pose recovery and HTTP boundaries. See [Trial 2 verification](docs/trial2.md#verification) for reproduction and browser-check scope.

Trial 1's recorded baseline evidence remains **35 passing unit tests** at v0.5.2. Its runtime source and running container were preserved during Trial 2 setup.

## Scope and limitations

RailSyn supports process exploration and controller experiments. It does not include calibrated manufacturer CAD, physical contact/gravity simulation, collision avoidance, grip-force computation, mechanical fit validation, real vision processing, real-time control guarantees or a trained AI model. Modeled gates are not safety-rated interlocks. S2/S3 are parked; multi-carrier scheduling and disassembly remain future work. Research novelty and industrial benefit require comparison experiments and measured data.

Both containers publish only on host loopback. Mutations require a process-local token and valid origin; physical-command requests are rejected. These controls support local use, not public hosting or remote robot operation. See [security boundaries](SECURITY.md).

## Documentation

| Document | Purpose |
|---|---|
| [Trial 2](docs/trial2.md) | Setup, robot roles, controller behavior, testing and limitations |
| [Trial 2 design](docs/trial2-spec.md) | The implemented experiment's design constraints |
| [Trial 1 user guide](docs/guide.md) | Baseline selection and controller workflow |
| [Trial 1 Docker](docs/docker.md) | Original service on port 8640 |
| [Trial 1 architecture](docs/architecture.md) | Original runtime and generated models |
| [Trial 1 integration](docs/integration.md) | Read-only external sensor bridge |
| [Trial 1 validation](docs/validation.md) | Baseline verification evidence |
| [Research](docs/research.md) | Proposed hypothesis and evaluation direction |
| [Credits](docs/credits.md) | Asset provenance and third-party licenses |
| [Change history](CHANGELOG.md) | Versioned changes |

## Maintainer and licensing

Maintained by **Abdullah Al Foysal** · [Foysal-A-Al](https://github.com/Foysal-A-Al).

Public research repository. No open-source license is assigned to project code yet, so the source is viewable and runnable but not yet licensed for redistribution or reuse. Three.js retains its [MIT license](public/vendor/THREE-LICENSE.txt), and the bundled Poly Haven lighting environment is CC0. Robot/tool meshes are project-created estimates rather than manufacturer CAD. See [credits](docs/credits.md).
