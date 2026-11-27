# Dashboard

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

7. **What the funnel counts.** The funnel shows how much value reaches each stage. It counts each deal in every stage up to the furthest one it has reached, using its stage history, so it narrows from New to Won. A deal dragged straight from New to Proposal counts in Qualified too. A lost deal counts up to the furthest open stage it reached before it was lost, and a line under the funnel gives the total lost. A won deal counts in every stage, and a deal moved back out of Won counts as open again, up to the furthest open stage it has reached. The funnel covers every deal, with no date range, the same as the pipeline board.

## Screen

**Dashboard** (`/`), the landing page: how sales are going at a glance. It should be visually stunning, with a line chart, a bar chart and a visual of the pipeline. The figures are defined under Dashboard figures, below.

- **Revenue won this month**, the main figure. It gives last month's figure, and the total and number of deals won in the last 12 months.
- **Revenue won by month**: a line chart of the last 12 months, beneath the main figure.
- Three tiles: deals won this month (with last month's count), open pipeline (with its number of deals) and expected revenue (with its share of the open pipeline).
- **Deals won by month**: a bar chart of the same 12 months.
- **Open pipeline by stage**: the visual of the pipeline. Each open stage shows its value and expected revenue, with its count on hover and in the table for screen readers (see Charts).
- **Sales funnel**: value and count reaching each stage from New to Won, with the share of New's value that reaches each stage, and the total lost underneath.
- **Follow-ups**: overdue first, then due in the next 7 days. Each shows its type, its description, the contact or deal it's on (as a link), its due date as "3 days overdue", "Due today", "Due tomorrow" or "Due in 4 days", and a Done checkbox. The heading gives the count. The list scrolls inside its panel when it's long.
- **Recent activity**: the 10 newest timeline entries of any kind, from anywhere in the app, grouped under Today, Yesterday and Earlier, each linking to its record.
- The tiles and the pipeline visual link to the Pipeline.

## Dashboard figures

Months are calendar months on the computer's own clock. "Won in a month" means a Won deal whose close date falls in that month.

| Figure | How it's worked out |
|---|---|
| Revenue won this month | Total value of the deals won this month. Last month's total is shown beneath. |
| Deals won this month | Count of the deals won this month. Last month's count is shown beneath. |
| Open pipeline | Count and total value of open deals. |
| Expected revenue | Total of value times probability over open deals (R2). |
| Open pipeline by stage | For each open stage: count, total value and expected revenue. |
| Revenue won by month | Total value won in each of the last 12 months, this one included. Months with nothing won show $0. |
| Deals won by month | Count of deals won in each of the same 12 months. |
| Sales funnel | For each stage from New to Won: the count and total value of deals that have reached it (concern 7). Underneath: the count and total value of lost deals. |
| Follow-ups | R9, overdue first, oldest first, then the rest, soonest first. |
| Recent activity | The 10 newest activities, stage changes and status changes, by when they happened. |

## Charts

With Recharts:

- **Colors by meaning:** "won" figures are Sea Green, and anything by stage uses the stage colors. In dark mode the charts use the dark values of the same roles, so the axis labels, gridlines, funnel gaps and the tinted part of each stage column follow the mode.
- **Revenue won by month:** a 2.5px Sea Green line over a flat 12% Sea Green area, with points shown on hover. Month labels run along the bottom and short USD amounts up the side, with horizontal gridlines only.
- **Deals won by month:** Sea Green bars with rounded tops and the count above each bar.
- **Sales funnel:** a funnel of joined trapezoids, one per stage from New to Won, each in its stage's color. Each one narrows from its own stage's value to the next stage's, with a 2px gap between them, and Won is a plain rectangle.
  - Labels to the right give each stage's name, count, short value and share of New's value.
  - A line underneath gives the total lost.
- **Open pipeline by stage:** one column per open stage, its height set by total value, with rounded tops.
  - The expected part is solid in the stage's color, from the baseline up, and the rest is in its tint.
  - The short value sits on top, with the stage's name and its expected revenue underneath.
- **Tooltips:** on the raised surface, with full USD amounts in JetBrains Mono.
- **Text and alternatives:** every chart has a title and a one-line summary in words, such as "$612,000 won in the last 12 months", plus a table of its figures for screen readers. Several brand colors are below 3:1 against white, so every figure is also given in text, never by color alone.

## Layout

- **Dashboard,** on a 12-column grid:
  1. Today's date as the accent, above the title "Dashboard".
  2. A large panel (8 columns) with revenue won this month and, beneath it, revenue won by month, beside the three other tiles stacked (4 columns).
  3. Deals won by month, Sales funnel and Open pipeline by stage, 4 columns each.
  4. Follow-ups and Recent activity, 6 columns each.

## API

| Method and path | What it does |
|---|---|
| `GET /api/dashboard` | Every dashboard figure, the follow-ups and recent activity |
