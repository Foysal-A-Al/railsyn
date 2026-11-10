# Read-only connection contract

The app does not move real equipment. A bridge running locally can forward measured data into the simulated controller. The packet model is intentionally independent of a vendor.

1. Run the app on the computer receiving the measurement stream.
2. Your trusted local bridge obtains the per-process token with GET http://127.0.0.1:8630/api/session. Do not log or persist the token.
3. Send POST /api/ingest with Content-Type: application/json and X-RailSyn-Token set to that token.
4. In the UI pause the simulation, select External read-only bridge, then start. Missing/stale packets hold simulated motion.

Packet example (timestamp must be replaced with current Unix milliseconds):

```json
{"device":"external-sensor-1","sequence":1,"timestamp":1794319200000,"acceleration":[0.02,0.01,0.03],"partPresent":true,"gripConfirmed":true}
```

Sequence must increase for the lifetime of the app process; restarting the server resets it. Sequence replay protection is per process, not persistent. Timestamp skew is limited to one second; packet reception expires after 500 ms. Acceleration is in m/sÂ², assumed gravity-removed in the adapter. All three values must be finite and within +/-100. Every packet carries the two confirmation flags. This simple contract assumes a single bridge that synchronizes its constituent sensor inputs; real multi-sensor time alignment is pending.

Device ID is a schema identifier, not a cryptographically authenticated hardware identity. Loopback and the per-process token protect the local API; mutually authenticated remote networking is not implemented. External packets supply measurements and confirmation flags only, never desired joint positions or control instructions. POST /api/hardware-command always rejects.

Proposed future adapter interface:

```text
DeviceAdapter.read_state() -> timestamped measurements + quality + units
DeviceAdapter.capabilities() -> supported tasks, frames, limits
```

Future physical motion requires a separate reviewed driver, manufacturer-specific kinematics and limits, calibrated frames/TCP, interlocked cell control, communication watchdogs, approved operating modes and local commissioning by the lab. Supervisory suggestions must remain distinct from the vendor's motion and safety controller. The current simulation ownership lock is not a safety-rated collision interlock.
