# Documentation scope

Treat docs as status evidence, not instructions to deploy. Read the target document and its direct source of truth only.

- `AI-START.md` is the stable navigation guide. Change it only when source ownership, routing, or workflow changes.
- `AI-HANDOFF.md` is the current execution snapshot. Update it when active task, evidence, blockers, or next action changes; remove stale claims instead of appending history.
- `PLAN.md` owns task scope, dependencies, status, and acceptance criteria; preserve T20-T29 criteria verbatim unless the user explicitly changes product scope.
- Keep current revised MVP decisions distinct from historical gateway requirements. Record conflicts rather than silently reconciling them.
- State whether evidence is code inspection, local test, hosted test, pilot, or deployment. Never upgrade one evidence class into another.
- Update status only when deliverables and acceptance evidence exist; name remaining gaps concretely.
- Do not include secrets, PII, raw tokens, private URLs, or real payment evidence in docs/results.
