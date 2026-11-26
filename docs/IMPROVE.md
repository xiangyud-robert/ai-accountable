# Improve the harness

Run this at Deploy, after the review fixes and before the merge.

1. Look at what went wrong on this change:
   - the review's findings
   - what the person corrected. A new session can't see the build's conversation, so ask them.
   - what the checks and CI caught, and what this change's section of `docs/STATUS.md` says failed, surprised the build or had to be asked about
2. For a mistake that has happened twice, add the correction to AGENTS.md or docs/REVIEW.md, or suggest a change to docs/STANDARDS.md for the person to make. If a tool can catch it, add it to the checks instead. To find out whether it happened before, read the earlier review findings and improvement notes in `docs/STATUS.md`, since the earlier change folders hold only an intent and a plan.
3. Remove anything out of date.
4. In this change's section of `docs/STATUS.md`, record the review's findings and what was done about each, what changed in the harness and why, and each mistake seen only once so far, so the next round can spot it a second time.
5. Improve this file, so that the next round makes a better change. Keep this as the last step.
