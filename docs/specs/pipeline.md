# Pipeline

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

8. **Moving a deal back out of Won or Lost** keeps its close date as it is, so the deal shows as late if that date has passed, which prompts a new expected date. It takes its new stage's usual probability, and its main contact stays a customer, since a contact's status never goes back by itself (R7).
9. **Won and Lost column figures.** Each open column on the pipeline shows its total value and expected revenue. For Won the expected revenue would equal the total, and for Lost it would always be $0, so those two columns show only their total value. The board's figures cover open deals only.

## Screen

**Pipeline** (`/pipeline`)

- The header shows the board's figures for open deals, side by side: the number of open deals, their total value and their expected revenue. It also has an Add deal button, for a new deal in New.
- There's one column for each of the six stages, in order, and every deal is on the board. Each column heading shows:
  - the stage's name and color dot
  - its count and total value
  - in open columns, its expected revenue and a thin bar showing the expected share of the value
  - in Won and Lost, "Won, all time" or "Lost, all time"
  - an Add deal button that starts the new deal at that stage
- A card in an open column shows the main contact's initials and name, the deal's name, value, probability and close date, and a Late badge if it's late.
- Cards in Won and Lost are compact: the deal's name, value and close date.
- Cards leave out the organization to save space. It's on the deal's page and in the Deals table, and the sample data's deal names start with it.
- Clicking a card, or pressing Enter on it, opens the deal's page.
- Dragging a card to another column or to another place follows R3 and R5. A card can be dropped anywhere in a column. Every figure on the board changes as soon as the card is dropped, before the server replies. If the save fails, the card goes back to where it was and a message says so. Any other card moved since stays where it was dropped.

## Components

- **Pipeline column headings:** white panels, rounded 14px, holding:
  - the stage's dot, name and count, and the Add deal button
  - the total value
  - in open columns, the expected revenue, and a 4px bar in the stage's tint whose filled part, in the stage's color, is the expected share of the value
- **Pipeline cards:** white with the panel shadow and 12px padding.
  - The top line has the main contact's initials in a 24px circle in the stage's tint, their name in Slate, and the Late badge on the right if needed.
  - Then come the deal name in 13.5px semibold, the value with the probability beside it, and the close date with a calendar icon, in Raspberry text when the deal is late.
  - Won and Lost cards are compact, with 10px padding: the deal name, then the value and close date.
  - A card being dragged gets a deeper shadow, and the place it will land shows as a tinted space.

## Layout

- **Pipeline:**
  - The open columns take 1.2 shares of the width and Won and Lost 0.8 each. At 1440px that makes the open columns about 200px wide and Won and Lost about 135px. If the open columns would be narrower than 170px, the board scrolls sideways.
  - Each column fills the height of the window and scrolls on its own, with its heading panel staying in place.
  - The cards sit below their heading on the page background.

## Keyboard and accessibility

- **Pipeline,** with keyboard moves of our own rather than the drag library's, which moves by screen position. They use the same move function as dragging, so both follow the same rules:
  - Tab reaches each card.
  - Space picks a card up, Up and Down move it within the column, and Left and Right move it to the next column, keeping its position where possible.
  - Space drops it, and Escape puts it back where it was.
  - Enter opens the deal when no card is being moved.
  - A screen reader announces each step, such as "Picked up Harbor Logistics fleet analytics, in Proposal, position 2 of 5", and "Dropped in Negotiation, position 1 of 4".
