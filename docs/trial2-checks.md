# Trial 2 delivery checks

## Baseline and separation

- Trial 1 source baseline: `53901bd7463b281faa7240929e7937be7855f449`.
- Preserved branch and tag: `trial-1`.
- Trial 1 remains the `railsyn` Compose project at port 8640.
- Trial 2 uses `railsyn-trial2`, `Dockerfile.trial2` and port 8641.
- Trial 1 container identity was unchanged after initial Trial 2 deployment.

## Process and API

Initial 0.6.0 result: **15 passed, 0 failed**, Node 24, isolated Docker container with no network, read-only image, dropped capabilities, explicit empty/allowlisted process environment and bounded resources. Reproduction is in [Trial 2](trial2.md#verification).

Initial RED run: all nine initial behavior tests failed with the Trial 2 engine absent. After implementation, all nine passed. Apply and paused-pose recovery were then reproduced as two failing regressions before being fixed.

A fresh source review identified three further defects: retained recovery poses, Step state leaking into the next Run, and duplicate workpiece ownership during fixture transfer. All three were reproduced in tests, fixed, and passed with the complete 15-test suite.

## Design decisions

- The existing app stays runnable as Trial 1; Trial 2 adds files rather than rewriting baseline runtime code.
- S1 alone executes jobs. S2/S3 are visible parked carriers; no multi-carrier scheduling claim is made.
- Native diagrams, Blender robot meshes and procedural station geometry explain the experiment without embedding reference images or slides.
- A separate Dockerfile ignore file preserves the Trial 1 build inputs.
- Tutorial previews are local explanations and do not issue motion commands.

## Verification boundaries

Unit/API tests establish deterministic state behavior and local HTTP boundaries. They do not validate calibrated robot geometry, physical fit, collision avoidance, forces, real sensing, hardware operation, industrial throughput, energy consumption or novelty.

The review's early-open tool-preview issue was treated as a functional issue because How it works must be usable while assets load. Browser checks exercise delayed HDR loading, opening the hardware tab first, and subsequent canvas refresh.

## Version 0.6.7

The isolated Node suite passed all 18 checks. Chromium exercised the architecture guide, live responses, all seven isolated study candidates, the operator loading animation, rendered grip contact points, four ordered dispatches, recovery and mobile layout.
