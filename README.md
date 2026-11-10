# RailSyn

A local 3D simulator for a three-robot assembly line on a rectangular rail. Choose a cup/body, a first cap and a top cover; press Run to execute one assembly and collect it at the outfeed. Mixed types are allowed. The next job waits for your explicit selection and Run.

**Simulation only.** Robot geometry is estimated, sensors are synthetic unless a read-only bridge is selected, and physical fit, forces and collision clearance are not evaluated. No physical robot commands are implemented.

## Start

Requires Node.js 22 or later. Bundled browser dependencies and assets are included; no `npm install` or API key is needed.

```sh
npm start
```

Open <http://127.0.0.1:8630>. On Windows, double-click **start.cmd**. The original `Start-RailSyn.cmd` and `node server.mjs` entry points remain compatible with existing shortcuts.

## Three stations

| Robot | Job | Tool |
|---|---|---|
| R1 loader | Move the selected body to the carrier | Four-cup vacuum plate |
| R2 capper | Place the selected first cap | Parallel jaws |
| R3 closer | Place the selected top cover | Three-finger collet |

The finished assembly moves onto the collection conveyor. The empty carrier follows the return rail, then the simulator stops and waits for the next selection. These are proposed job assignments informed by photos and the user's description, rather than a calibrated reproduction of the lab.

## Project layout

| Path | Contents |
|---|---|
| `src/server.mjs` | Loopback HTTP server and fixed API/static routes |
| `src/simulation.mjs` | Process state, robot coordination, inventory and sensor logic |
| `public/` | Browser interface, shared geometry/catalog modules and styles |
| `public/assets/` | Runtime robot model and studio environment |
| `public/vendor/` | Bundled Three.js modules and license |
| `scripts/build-models.py` | Blender source for estimated robot meshes |
| `tests/unit/` | Automated simulation and asset tests |
| `tests/browser/` | Windows Chrome controller regression checks |
| `docs/` | User guide, integration, architecture, validation and research notes |

## Checks

```sh
npm test
```

Optional Windows Chrome UI checks, with the server running:

```sh
npm run test:selection
npm run test:stop
```

Browser checks reset and operate the simulation. They write internal screenshots and results to ignored `.qa/`; run them only when you are ready to replace the current demonstration state. The selection check leaves one completed job stopped at the loader.

## Documentation

- [User guide and controller](docs/guide.md)
- [Architecture and development](docs/architecture.md)
- [Read-only sensor integration](docs/integration.md)
- [Validation and limitations](docs/validation.md)
- [Research direction and prior art](docs/research.md)
- [Asset credits](docs/credits.md)
- [Security boundaries](SECURITY.md)
- [Change history](CHANGELOG.md)

The server binds to `127.0.0.1:8630`. Keep this prototype local. There is no manufacturer safety controller, physical emergency stop or real-time motion guarantee.

## Asset rights

Three.js is bundled under its [MIT license](public/vendor/THREE-LICENSE.txt). The Poly Haven studio HDR is CC0; see [credits](docs/credits.md). Robot meshes are project-created estimates, not manufacturer CAD. No open-source license is granted for the project code at this time; third-party licenses remain applicable.
