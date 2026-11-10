# Change history

## 0.5.1 — 2026-11-10

- Organize runtime code under `src/`, unit/browser checks under `tests/`, and the Blender generator under `scripts/`.
- Add a concise README, development architecture, security boundaries and asset credits.
- Use simple lowercase documentation filenames and preserve existing launch commands.
- Exclude local profiles, test recordings, exports, credentials and temporary files from Git.
- Preserve explicit three-part selection and one assembly per Run.

## 0.5.0 — 2026-11-10

- Allow any in-stock cup, cap and top-cover combination without type matching.
- Remove automatic matching and multi-job batches.
- Require explicit selection and Run for every assembly; Apply does not start motion.
- Retain finished products at the outfeed and wait for a new selection after carrier return.
