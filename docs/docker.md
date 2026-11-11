# Docker

> This document describes **Trial 1**. For the new independent experiment, see [Trial 2](trial2.md).

## Start the application

Docker Desktop must be running with Linux containers enabled. From the repository root:

```sh
docker compose up -d --build
```

Open **http://127.0.0.1:8640**. The Compose project is `railsyn`; its app image is `railsyn:local`. The dedicated port **8640** is separate from the native launch on 8630 and from the other projects. Docker startup does not select parts or execute an assembly. Choose all three parts and press Run in the browser.

The first build downloads a pinned official Node 24 Alpine image. Runtime dependencies, robot meshes and the HDR environment are already in the source; the build does not install npm packages.

## Everyday commands

| Action | Command |
|---|---|
| Start after setup | `docker compose up -d` |
| Update after a Git pull | `docker compose up -d --build` |
| View service and health | `docker compose ps` |
| View recent logs | `docker compose logs --tail=50 app` |
| Stop | `docker compose stop` |
| Remove this project's container and network | `docker compose down` |

The simulator state is in memory. Restarting or recreating the container resets the demonstration; export a run before stopping if needed. No persistent volume is required. Browser downloads are saved by your browser on the host.

## Isolation

The application runs as UID/GID 1000, with a read-only filesystem, a bounded temporary directory, dropped Linux capabilities, no privilege escalation, process/memory/CPU limits, and a dedicated bridge network. Only host loopback port 8640 is published. There are no host directory mounts or Docker socket mounts. Other Compose projects and containers are not modified.

The container listens on its internal network interface so Docker port forwarding works. Browser-facing Host and Origin checks still accept only `127.0.0.1:8640`. Native execution defaults to `127.0.0.1:8630`. `RAILSYN_PORT` and `RAILSYN_BIND_HOST` are validated at startup. The container health check reads simulation state; it does not start a job.

## Isolated unit tests

Build the dedicated test image:

```sh
docker build --target test -t railsyn:test .
```

Run model tests without network access or host mounts:

```sh
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 1 --ulimit nofile=256:256 --ulimit fsize=16777216:16777216 --tmpfs /tmp:rw,noexec,nosuid,size=16777216,mode=1777 --env HOME=/tmp --env TMPDIR=/tmp railsyn:test
```

Unit tests do not operate the running app. Windows Chrome browser workflows remain separate checks and default to the native server on port 8630; they are not included in the runtime image.

## Port conflicts

If 8640 is occupied, identify the owner before changing anything. Do not stop another project to free the port. Choose a new unused port and update both sides of the Compose port mapping, `RAILSYN_PORT`, and the documented browser URL together. Do not publish to `0.0.0.0` on the host.
