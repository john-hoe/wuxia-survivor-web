# Current project status

Last verified: 2026-07-30

The runtime currently contains three selectable maps, map-specific bosses and
music, five automatic skill families, progression, settlement, scripture pulls,
meridian upgrades, local saves, keyboard controls, touch controls, and a DOM
accessibility bridge.

The authoritative executable checks are:

```bash
npm run check
```

Historical documents describe the state and intent at the date written. When a
historical document conflicts with runtime code, current tests, this status
page, or a newer dated remediation report, it is superseded and must not be used
as evidence of the current build.

Historical evidence links under `evidence/2026-05-*` are not present in this
public checkout. Their old `done/yes` labels therefore mean “recorded by the
original team”, not “independently verifiable from this clone”. Current claims
must point to tracked evidence produced by the current commit.

Known release boundary: audio provenance is incomplete and no open-source
license has been granted. See `assets/audio-provenance.json` and
`../LICENSE-STATUS.md`.
