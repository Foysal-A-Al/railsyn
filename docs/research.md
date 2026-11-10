# Direction and prior art â€” 10 November 2026

## The proposed contribution

A sensor-aware handoff coordinator combining vibration settling, packet freshness, resource reservation and robot availability. The first implementation is deterministic and explainable; it is not an AI model. The hypothesis is that sensor-aware timing handles variable settling better than a fixed delay, while the ownership and freshness rules prevent logically invalid handoffs in the simulator.

Novelty is unresolved. A short search cannot prove that no one has considered this. Robot/sensor simulation, industrial hardware abstractions, multi-robot conveyor coordination and vibration-reducing pick/place methods already exist:

- NVIDIA Isaac Sim: https://developer.nvidia.com/isaac/sim â€” robot/sensor simulation and digital twins.
- ROS 2 hardware interfaces: https://control.ros.org/jazzy/doc/ros2_control/hardware_interface/doc/hardware_interface_types_userdoc.html â€” joint, sensor and GPIO interfaces.
- Bozma and KalalÄ±oÄŸlu, Multirobot coordination in pick-and-place tasks on a moving conveyor: https://doi.org/10.1016/j.rcim.2011.12.001
- Shan et al., Residual Vibration Reduction of High-Speed Pick-and-Place Parallel Robot Using Input Shaping: https://doi.org/10.1186/s10033-022-00679-3
- BrÃ¼ckmann et al., Optimal control approach for trajectory determination to suppress residual frame vibrations of delta robots in pick and place tasks: https://doi.org/10.1016/j.mechmachtheory.2025.106302

These papers concern related problems and do not establish novelty of this prototype. The present prototype does not implement their optimization or input-shaping algorithms.

## Development stages

1. Current: three separated workcells, distinct body/lower-cap/upper-cap jobs, shared rail handoff interlocks, modeled six-axis joints, synthetic sensors, fault injection and read-only measurement ingress, supported offloading, persistent output collection and continuous empty-carrier return.
2. Identify exact robot and rail controllers, obtain permitted data sources and CAD/URDF, measure frame geometry and sensor locations. Record real acceleration with documented sample rate, units, bandwidth and time synchronization.
3. Calibrate sensor baselines by load and operating stage; compare RMS, vibration envelope and frequency-domain settling estimates. Separate benign process changes from faults. Avoid labeling high vibration as a diagnosed bearing or mechanical defect without evidence.
4. Implement actual read-only vendor adapters and replay synchronized recordings through the cell model. Validate stale-data handling, sequence resets and missing confirmations.
5. Design and commission physical command integration separately under the lab's equipment procedures. Validate reachability, collisions, grip loads, safe recovery and vendor controller behavior locally before automatic operation.
6. Evaluate fixed-delay vs sensor-gated handoffs using randomized condition order and matched load/speed combinations. Report unsuccessful handoffs, waiting time, throughput, false holds and recovery time. Determine repetitions from variance/power analysis; do not invent improvements from synthetic runs.

## Necessary next evidence

- Exact orange robot model/controller, UR10 generation/controller and which cell each belongs to. Photographs show different devices; their co-location does not prove they share a controller.
- Rail vendor and control interface, travel limits, carrier identity scheme, and PLC involvement.
- Sensor models, axes, mounting locations, sample frequencies, synchronization and access permissions.
- Workpiece mass, dimensions, gripper and confirmation sensors; target points and validated tool frames.
- A broader paper and patent search with explicit inclusion criteria before any patent or first-of-its-kind claim.
