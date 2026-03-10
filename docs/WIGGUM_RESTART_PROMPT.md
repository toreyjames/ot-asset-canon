# WIGGUM Restart Prompt

Use this at the start of any new Codex session to continue autonomous refinement quickly.

## Prompt
Continue PlantTrace refinement from `/Users/toreyhall/ot-asset-canon` using `docs/WIGGUM_RUNBOOK.md`.

Rules:
1. Run one full iteration across persona passes (Plant Manager, OT Engineer, Controls/Process, Security).
2. Pick top 1-2 backlog items from the runbook and implement.
3. Keep the product centered on:
   - How many assets do we have?
   - What are we missing that blocks reliable operation?
   - How do we know that?
   - What data do we need next, and from which unit/layer?
4. Build, commit, push, and deploy to Vercel production.
5. Append an entry to `Iteration Log` in `docs/WIGGUM_RUNBOOK.md`.
6. Keep UX engineering-first: unified asset list first, filters, map as drill-down.

Output format:
- What changed
- Why it improves user value
- Remaining blockers
- Next iteration candidates
