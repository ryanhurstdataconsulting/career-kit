---
name: jobs
description: Show her job pipeline as a prioritized table — most actionable first. Use when she asks where things stand or what to do next.
---

# /jobs — the pipeline, prioritized

1. Run `node apply/queue.mjs --list` (JSON). If the tracker is empty or
   missing, say so warmly and offer to run a scan of her job boards instead.
2. Present a tidy table: **Priority | Company | Role | Score | Status | Next
   step**. Keep the script's ordering — it puts what needs her attention
   first (offers to decide on, interviews to prep, replies to send, then jobs
   ready to apply to), with higher scores first within each group.
3. Write the "Next step" column yourself, in plain language ("Apply — resume
   is ready", "Reply to the recruiter", "Prep: interview on file").
4. Bold the single best next action and offer to start it — usually `/apply`
   on the top ready job.
5. If she wants totals or history, use upstream tracker mode and
   `node stats.mjs`.

Keep it skimmable: at most 15 rows, then "…and N more" for the rest.
