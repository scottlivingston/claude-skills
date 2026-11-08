# Cleanup

Branch: `main` · PR per slice: not asked · Status: active

## Destination

Tally is solid enough to build on: the known bugs below are fixed at their cause, not patched over, and each fix is
covered by a test. The effort ends when we agree the list is cleared.

## Where it stands

A small Python library (`tally/`) for reading time-tracking exports and summarising them, written quickly a year ago.
Known bugs, collected over the last year from user reports, worst first:

- **Cache never evicts** — `TTLCache.get` returns expired entries and never deletes them, so a long-running
  `tally serve` grows without bound; it fell over after about a day in prod. Top priority.
- **Bad config silently ignored** — `load_config` swallows parse errors and falls back to defaults.
- **Durations drop the hours** — `parse_duration("1h30m")` comes back as 30 minutes.
- **Duplicate CSV header on append** — `export_csv(rows, path, append=True)` writes the header again every time.

Nothing has been changed by this effort yet.

## Fog

- Whether the CSV export format can change — settle if a slice runs into it

## Slices
