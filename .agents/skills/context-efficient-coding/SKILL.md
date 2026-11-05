---
name: context-efficient-coding
description: Keep coding tasks token-efficient and on-scope through small context budgets, one-task focus, concise updates, and impact-based verification. Use by default for nontrivial implementation, debugging, or review.
---

# Context-efficient coding

Minimize context and output without dropping requirements, evidence, or security boundaries.

## Pin one target

Before tools, identify internally:

- one requested outcome;
- one active roadmap task, if any;
- at most three acceptance criteria advanced now;
- explicit exclusions.

Do not narrate this plan unless ambiguity affects the user. For Dolend, T20 then T21 are MVP gates; T22-T29 stay out of scope unless requested. Never weaken their acceptance criteria.

## Context budget

Start with this maximum working set:

- root plus nearest scoped `AGENTS.md`;
- for Dolend roadmap continuation, `docs/AI-HANDOFF.md` as current snapshot;
- active task slice from `PLAN.md`, not the whole file;
- one relevant domain document;
- changed files, direct contract/caller, and nearest test, usually 3-6 files total.

Use `rg -n` first, then read narrow line ranges. Do not inventory the repo, preload directories, reread unchanged files, or reopen an entire large file after locating the needed section. Exceed the budget only for a named unresolved dependency, security invariant, or failing check.

## Execute on point

- Map every edit to the request or pinned acceptance criteria. Skip adjacent cleanup and future tasks.
- Reuse existing patterns before adding abstractions, dependencies, scripts, or docs.
- Prefer one minimal reviewable patch. Preserve user changes and generated/migration boundaries.
- Follow root security rules. Stop before deploy, hosted mutation, push, or external side effects unless explicitly requested.
- If current product decisions conflict with historical text, follow the explicit superseding decision and report the conflict. Do not silently rewrite criteria.

## Token-efficient communication

- Commentary only at start, meaningful change, blocker, or verification. No tool-by-tool narration.
- Each update: one to three short sentences. State result first.
- Do not repeat request, plan, file inventory, or already reported facts.
- Final: at most five bullets unless risk or failure needs more detail.
- Keep exact commands/errors only when useful for reproduction.

## Verify proportionally

Run the smallest check that can falsify the change, then widen only if impact or failure requires it:

- docs/instructions: frontmatter, paths, links, diff, source-of-truth consistency;
- frontend: nearest test plus scoped lint/build/typecheck requirements;
- API/security: check/tests plus relevant negative authorization cases;
- database: migration replay/invariants; no hosted work without explicit scope.

Do not rerun an unchanged passing suite. Never promote local evidence to hosted or production evidence.

## Compact handoff

Report: outcome; key files; verification; remaining blocker/next task. Omit exploration log and full plan.
