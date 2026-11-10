# Using RailSyn

## Three different jobs

| Cell | Operation | Tool | Station |
|---|---|---|---|
| R1 loader | Transfer a body from supply to the carrier nest | Four-cup vacuum plate | Body supply tray and carrier docking fixture |
| R2 capper | Pick and seat the first cap | Parallel jaws | Pocket tray of lower caps and locating clamps |
| R3 closer | Fit the upper cap | Three-finger radial tool | Double-stack cap tray, docking fixture and assembly-check portal |

These are concept job assignments based on the user's description, not a verified reproduction of the actual production program. The photos do not show the orange robot's full end effector or establish all station connections. The multi-cup tool visible on the yellow robot was a visual reference; the body-loader assignment and four-cup layout are estimates.

The rail has long straight sections, compact rounded corners and a return lane. Workcells are separated along the line; the second robot is across the transport lane. One tracked assembly gains its body, lower cap and upper cap in order. Carrier indexing is blocked while a robot holds a part. After assembly the same carrier docks at an outfeed lift. The complete product is raised clear of the side guides, pushed laterally onto a supported roller conveyor and retained in a four-place collection buffer. The pusher retracts, the empty carrier lowers onto the track and physically follows the right corner, return lane and left corner back to the loader. The simulator then waits for a new explicit selection; it never chooses or starts the next workpiece. Inventory contains four cup/body fixtures, nine lower-cap pockets and nine two-cover stacks. Continuous multi-carrier scheduling is not implemented.

## Choose exactly what to pick

The **Job setup** panel is the source of the active recipe. Choose B1â€“B4 for the cup/body fixture, C1â€“C9 for the lower cap and T1â€“T9 for the upper cover. The same numbered pockets can be selected by clicking parts in the 3D view. Rings highlight the preview selection; color, family and quantity are shown in the tray maps.

- Select all three sources yourself. Any in-stock combination is allowed, including mixed A/B types. Types are descriptive metadata; physical fit, contact and forces are not evaluated.
- **Apply selection** updates actual robot pickup points, including the exposed height of a double-stack cover. It does not move a robot.
- **Run selected job** applies the valid recipe, enables simulated drives and starts automatic operation. Invalid/empty pockets and lack of output space block the command. Different part types are allowed.
- Each Run executes exactly one selected assembly. There is no auto-match or batch-size control. After collection and empty-carrier return, the draft clears and Run waits for three new choices. Source stock is removed only after grip confirmation. Depleted slots stay empty.
- Recipe changes require a stopped carrier at the loader and no unrecovered manual pose changes.
- A new recipe can be selected after job completion without clearing collected assemblies or replenishing used stock. **Reset cell** explicitly resets the entire demonstration.
- The **Hold at inspection** destination keeps the verified assembly on its carrier. **Release inspection hold**, then Run, sends it to collection. This uses the existing output station; it does not invent an arbitrary physical destination.

Active and preview selections are distinguished. The global Run button is disabled while unapplied selections exist. Part identities, families and colors are retained in finished assemblies and exports.

## Complete product destination

The **Outfeed** camera button frames the lift, pusher and four-place collection conveyor. The **Finished product collection** panel shows the same assembly IDs visible in the 3D buffer. Assemblies retain both caps and remain there after subsequent cycles and after the job ends. A modeled output blockage holds unloading. Job completion occurs only after the empty carrier returns; pausing during that return remains resumable. The controller and renderer share the same rectangular rail centre-line geometry. No carrier reset or product disappearance is used to transition between cycles.

The outfeed is a proposed simulation mechanism, not equipment confirmed in the supplied photos. A disassembly/recycling operation is not included.

## Where the controller is

The large dark **ROBOT CONTROLLER** panel sits beside the scene on desktop. R1/R2/R3 tabs select the controlled robot.

- Enable simulated drives, then press Run in PROGRAM mode.
- Pause and switch to MANUAL to jog any of six joints in 1Â° or 5Â° increments. Only the selected robot changes.
- Empty tools can open/close or switch vacuum on/off in manual mode. Manually releasing carried parts is blocked.
- Record pose adds the current selected robot's joints and TCP to the run export. Recorded points do not automatically become a new motion program.
- Step runs one process stage and pauses. Reset cell resets the modeled demonstration. Simulation Stop latches; the visible Clear simulation stop button acknowledges it while preserving the selection, stock and poses, with drives still off. Run recipe then enables Program mode and simulated drives. Both Run buttons use the selected recipe at the loader.
- After manual jogging or empty-tool actuation, use **Recover home** in enabled MANUAL mode. It returns empty tools to modeled home poses without erasing the recipe, inventory or collected products. Pause, Stop and drives OFF cancel an in-progress recovery. Jogging while a part is held is blocked; finish the automatic transfer first.
- I/O displays modeled carrier, assembly, grip and tool states. It is not a live PLC connection.

## 3D assets and motion

The articulated robot shells and three different tools are modeled in Blender and exported to `public/assets/cell-models.glb`. Rebuild with `blender -b --python scripts/build-models.py` from the project root. Arm shells have bevels, mechanical covers, flanges, bolts, cable sleeves and cup/finger geometry. The browser uses local Three.js physically based materials, a bundled Poly Haven photographic studio HDR environment, directional light and soft shadow maps. Gearboxes include recessed hubs and fasteners; service covers, fittings, cup interiors, cap profiles and instanced knurling add mechanical detail. The room environment is retained as a fallback if HDR loading fails. Select Station 1/2/3 for a close view; drag to orbit and scroll to zoom.

All six joint values feed a shared forward-kinematics model. Automatic point moves use an analytic IK solution with fixed downward tool orientation and a quintic position profile. Rendering and attached-part positions use the same FK, replacing the previous free-floating part animation. Wrist roll/bend/spin are visible in manual mode. Body/cap attachment occurs after tool contact and grip confirmation; release occurs at its supported destination.

The three visual styles are estimated industrial-arm concepts, not licensed/calibrated ABB, UR or FANUC CAD. Dimensions and limits are illustrative. There is no physics engine, continuous collision detection, gravity/contact model, grip-force calculation, real-time trajectory guarantee, manufacturer IK, certified interlock or safety controller. The scene should not be called a calibrated digital twin or a validated robot program.

## Sensors and research

The accelerometer is a clearly labeled synthetic 200 Hz damped-sine test signal. The gate uses maximum per-axis RMS over 100 samples and a 600 ms stable dwell after carrier indexing. The 0.30 m/sÂ² threshold and pressure response are illustrative. External packets can replace acceleration and presence/grip confirmation through a read-only local HTTP ingress; pressures and other I/O remain model states. External RMS uses up to 100 packets, with no guaranteed fixed-duration window.

Faults cover excess vibration, heartbeat loss, grip confirmation failure, assembly verification failure and output blockage. An in-flight grip fault holds motion and retains the modeled payload; this does not simulate the physical consequence of losing a real grip. See `integration.md` for the packet contract and `research.md` for the research hypothesis and prior art. Novelty and performance improvements remain unproven.
