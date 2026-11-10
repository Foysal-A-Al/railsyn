# Architecture and development

## Runtime

`src/server.mjs` owns one in-memory `Cell` from `src/simulation.mjs`, ticks it every 50 ms and serves only allowlisted local browser files. The process state is not saved across server restarts; export a run from the controller before closing the server if you need it.

The browser polls state and sends commands through the token-protected local API. `public/app.js` implements the controller, inventory selection and Three.js scene. `public/kinematics.mjs`, `public/rail.mjs` and `public/catalog.mjs` are shared with the simulation so displayed geometry and command targets agree.

The three robots execute different jobs. Selected source IDs become pickup coordinates, inventory is consumed on grip confirmation, and finished assemblies retain their source IDs in the outfeed. Each Run accepts exactly one assembly. Completion clears confirmation and waits for another explicit selection; no source matching or subsequent job selection occurs automatically.

## Directory conventions

Use short lowercase names with hyphens for project files. Keep server/state code in `src/`, browser-served files in `public/`, unit tests in `tests/unit/`, browser checks in `tests/browser/`, and prose in `docs/`. Root README, SECURITY and CHANGELOG use common GitHub naming conventions. Third-party filenames remain unchanged to preserve their imports and upstream identity.

Generated runtime model files belong in `public/assets/`; keep their source generator in `scripts/`. Internal recordings, profiles, run exports and scratch output belong in ignored `.qa/`, `exports/` or `tmp/`, rather than the repository.

## Model generation

From the repository root, with Blender installed:

```sh
blender -b --python scripts/build-models.py
```

This rebuilds `public/assets/cell-models.glb`. Normal use does not require Blender. The HDR source and licenses are recorded in [credits](credits.md).

## Development checks

Run `npm test` for simulation checks. Browser checks require Windows, Chrome at its standard install path and the local server. See the README before running them because they replace the current demonstration state. Use `npm run test:selection` or `npm run test:stop`.

Existing `node server.mjs` commands and the original Windows launcher delegate to the organized application entry points. The organization update changes file locations and documentation, without changing robot tasks or automatic motion behavior.

## Container execution

The dedicated Compose project runs `src/server.mjs` on port 8640 and publishes it only to host loopback. Native execution retains port 8630. `src/config.mjs` validates the port and bind interface without changing the accepted loopback browser authority. The runtime image includes only the server, shared/browser modules, package metadata and runtime assets. See [Docker](docker.md) for isolation and lifecycle commands.
