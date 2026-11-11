# RailSyn Trial 2

Keep Trial 1 at commit 53901bd and Docker port 8640. Add Trial 2 on its own unused port 8641 and Compose project. Do not recreate Trial 1.

Build an original Three.js scene, not a photo, slide or image mockup. Include a rectangular rail loop, lower U branch, warehouse, independent FANUC conveyor cell, UR3e assembly and UR10 dispatch. Show a modeled operator performing the manual loading step. Use approximate six-axis models and distinct SCHUNK-style two-jaw, OnRobot-style two-finger, and Robotiq-style three-finger tools. Clearly mark geometry, sensors and vision as simulated.

One selected workpiece, first cap and cover per job. Mixed types allowed. Execution actions belong only in the right controller. Support up to four explicitly selected recipes in order, with an operator loading stop for each. Complete tray loading, manual fixture loading, cap/cover assembly, modeled vision check, dispatch and empty return with visible supported parts and continuous rail travel. Dock/reserve/clearance/grip/output gates, stop and recovery must work. The three shuttles are visible but only S1 executes jobs in this trial; no unsupported multi-carrier scheduling claim.

How it works must be an interactive native page with original diagrams and live-linked station explanations, robot/tool detail, and a live response monitor and a speed study using an isolated copy of the simulator. Keep NSGA-II and calibrated energy as proposed research extensions. Tutorial previews and study runs must leave the production simulator state intact.

Keep source under trial2, shared bundled vendor/HDR assets read-only, no external runtime downloads, no new paid services, no hardware output. Save Git tag trial-1 and branch trial-1; main contains Trial 2 as a separate runnable application. Preserve Trial 1 launch commands and history.
