# Verification â€” 10 November 2026

Version 0.5.0: explicit mixed-part selection and one assembly per Run.

## Automated model checks

All 31 tests passed on the build host and Windows workstation. Coverage includes three distinct robot jobs, FK/IK and grip contacts, selected-source coordinates and identities, stock depletion, stacked-cover heights, persistent collection, continuous empty-carrier return, output-blockage recovery, vibration and heartbeat holds, manual jogging and recovery, latched stops, external-packet rejection and bundled import resolution.

New regression tests verify that mixed B2 + C1 + T3 is accepted and collected, startup and completed jobs require explicit selection, and counts other than one are rejected. Four collection pockets are tested using four separately selected jobs. Part type matching is no longer a constraint. Presence checks do not establish physical fit.

Run `node --test tests/unit/*.test.mjs`.

## Windows Chrome UI check

With the server running and default-path Google Chrome installed, run `node tests/browser/selection.mjs`. It uses an isolated headless Chrome profile, loads the actual 3D application and exercises the visible controls. It checks an initially disabled Run, absence of auto-match and batch controls, a mixed B2/C1/T3 selection, Apply without motion, Run for one selected assembly, preserved output identities, completion, unchanged inventory while waiting, cleared draft, disabled next Run and absence of page exceptions. It saves internal QA screenshots under ignored `.qa/` and leaves the simulator stopped after the tested job.

The separate `node tests/browser/stop.mjs` regression covers stop acknowledgement preserving selection and poses without starting motion, and selected-recipe Run enabling drives only after acknowledgement.

Earlier versions were also checked for selected-robot manual jogging, tool controls, pose recording, process stepping, fault holds, outfeed geometry, inventory ray picking, HDR loading and mobile width. Those historical checks do not substitute for the current targeted regression.

## Boundaries

This is targeted prototype verification, not a comprehensive security audit, physics validation, photogrammetric assessment or industrial safety certification. No real robot, gripper, rail or sensor was commanded. Physical dimensions, collision clearance, payload/contact dynamics, grip force and compatibility of arbitrary real parts remain unverified. Research novelty remains unproven.

## 0.5.1 organization checks

The source layout and import paths were reviewed after relocation. The previously recorded 31 passing model tests and Windows Chrome workflow belong to version 0.5.0; they are historical evidence, not a fresh execution of the reorganized tree. Post-organization runtime tests were not executed because the required isolated execution environment was unavailable in this session.
