# Trial 2

Trial 2 is a separate runnable experiment. Trial 1 is retained under Git tag and branch `trial-1` at `53901bd`, and its Docker service remains on port 8640.

## Setup

```sh
docker compose -f compose.trial2.yaml up -d --build
```

Open [Trial 2](http://127.0.0.1:8641). In Docker Desktop, find the `railsyn-trial2` project. Trial 1 is the separate `railsyn` project. Neither starts a job automatically.

```sh
docker compose -f compose.trial2.yaml ps
docker compose -f compose.trial2.yaml logs --tail=50 app
docker compose -f compose.trial2.yaml stop
```

The runtime uses pinned Node 24 Alpine, bundled modules, the Trial 1 Blender robot mesh asset and the existing studio HDR. No package installation occurs during the app build. It runs as UID 1000, read-only, with dropped capabilities, no-new-privileges, bounded CPU/memory/processes and loopback publishing. It has no bind mounts into your computer. A dedicated Dockerfile ignore file limits the build context.

Native alternative: `node trial2/server.mjs` with Node 22+. Use `http://127.0.0.1:8641`, including the numeric loopback host; other Host/Origin values are rejected deliberately.

## Product and controller

Select B1–B4, C1–C9 and T1–T9 explicitly. C pockets begin with one cap; T pockets have two stacked covers. Different source types may be combined. The destination is the finished-product rack with four pockets. After completion, pending selections clear and stock stays depleted.

Add up to four recipes in the right controller. Reorder or remove entries before pressing **Start queue**. At each setup stop, press **Place workpiece** to watch the operator pick the selected cup and seat it in the docked shuttle, then press **Resume queue**. The server validates stock and free dispatch pockets for the entire queue before starting.

Pause before switching to Manual. Enable drives and use 1° or 5° joint increments. Empty tools are required. After jogging or tool changes, Recover restores the saved program pose. A paused job keeps its progress and inventory. Clear simulation stop only acknowledges the latch; a separate Resume is necessary. Reset intentionally clears the demonstration, including collected products.

## Process ownership

| Stage | Owner | Completion condition |
|---|---|---|
| Tray loading | FANUC ER-4iA / SCHUNK-style two-jaw | Tray grip, supported release and robot retraction |
| Branch setup | Operator / shuttle nest | Selected B workpiece positioned in the nest |
| Assembly | UR3e / OnRobot-style adaptive two-finger | First cap, then cover, each confirmed and seated |
| Inspection | Modeled vision portal | Sequence present and synthetic vision gate accepted |
| Dispatch | UR10 / Robotiq-style articulated three-finger | Checked assembly transferred to available rack pocket |
| Empty return | Rail then FANUC | Tray returned to conveyor before the queue advances |

S1 travels continuously along the main loop and setup branch. S2/S3 are off-line parked carriers. There is no multi-carrier scheduler, occupancy arbitration among multiple active shuttles, live PLC connector, physical collision solver or disassembly operation.

## Explanation workspace

- **Production flow:** an original SVG diagram generated from the same route coordinates as the 3D model. Green marks live S1; blue marks an independent tutorial preview. Previewing does not issue simulator commands.
- **Robot & tool roles:** the three distinct modeled tools, jobs, controller modes and boundaries.
- **Control & handoffs:** command path, ownership transitions, inspection and fault responses.
- **System responses:** live controller state, payload owners, rack count and recent events.
- **Optimization study:** seven isolated speed candidates using the same cell model. Compare batch makespan, simulated throughput, waiting and optional energy estimates. NSGA-II remains a proposed research extension.

No source photos, PPT slides or human figures are embedded. Procedural metal/plastic geometry, environmental lighting and shadows supply the scene. Shapes and kinematic dimensions remain estimates, not calibrated hardware.

## Verification

Build the separate test target:

```sh
docker build -f Dockerfile.trial2 --target test -t railsyn:trial2-test .
docker run --rm --pull never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 1 --ulimit cpu=30:30 --ulimit fsize=1048576:1048576 --tmpfs /tmp:rw,noexec,nosuid,size=16777216 railsyn:trial2-test /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp TMPDIR=/tmp node --test --test-concurrency=1 trial2/tests/*.test.mjs
```

Recorded result: **18/18 tests pass**. Scenarios include startup without a recipe, exact mixed source propagation, process ownership, continuously sampled rail movement, grip/vision/output/vibration holds, stop acknowledgement, depleted pockets, separate jobs, Apply without motion, recovery to the paused pose and HTTP origin/token/static boundaries.

`trial2/tests/browser.mjs` is an optional UI check for an already available Node.js/Chromium toolchain. It uses a disposable server fixture and accelerated modeled time. It does not operate the deployed service. Set RAILSYN_TEST_CHROME to an existing Linux Chromium binary; the harness defaults to the local development toolchain path. no browser dependency is required by the application itself.

## State and integration boundaries

State is in memory. Exports are plaintext JSON snapshots containing only simulation values. They are not an executable robot program or an automatic restore file. No personal data, API keys or external requests are needed.

Trial 2 has local JSON APIs for session/state, commands, export and health. Static serving uses an explicit allowlist. Mutation requests require the per-process token, JSON content type and valid Host/Origin. Physical-command requests are always rejected. Trial 1's external measurement bridge is not connected to Trial 2. Real hardware integration requires a separately designed and validated adapter and remains outside this trial.

The process tests cover the manual loading hold, exact workpiece selection, stock consumption, and four ordered recipes.
