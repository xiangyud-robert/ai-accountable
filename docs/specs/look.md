# Look and feel

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

The dashboard's charts and layout, the pipeline's components, layout and keyboard moves, the dark mode colors and switch, and the layout of record pages are in their own area files.

The look follows Accountable's brand guidelines, which take priority over any general design guidance. It has a light mode, the default, and a dark mode, both designed for a laptop or desktop screen. Colors below are named by their light-mode value, and dark mode uses the dark value of the same role: "white" means the panel color, which is black in dark mode, "Midnight text" means ink, which is Sea Mist, and "Slate" means ink muted. Where a color stays the same in both modes, it says so.

## Concerns

4. **The brand's colors and WCAG AA.** Small text needs a contrast of 4.5:1. Measured against white:
   - White text on Cerulean is 3.96:1 and on Raspberry 3.62:1, though the brand pairs them.
   - Sea Green, Marigold and Coral as text are 1.62 to 2.35:1, as the brand itself warns.
   - Midnight text on Sea Green, Marigold and Coral passes, at 5.1 to 7.5:1.

   Full-strength brand colors are kept for fills, dots, chart marks, and Sea Green buttons with Midnight text. Text and any fill behind white text use the darker shades listed under Colors. Badges use a pale tint of the color with Midnight text. Concern 13 covers dark mode.

## The mockup

The look is mockup C, Focus, in `docs/mockups/c-focus.html`, with its screenshot in `c-focus.png`. The other two mockups in that folder, A and B, aren't used. What marks mockup C out:

- **The funnel and stage charts:** the funnel is drawn as a real funnel shape, and open value by stage as columns with the expected part solid.
- **The pipeline layout:** wider open columns, each under its own white heading panel, contact initials on the cards, and compact Won and Lost columns.

The rest of this file follows it, and so do the dashboard's and the pipeline's own look and layout, in `docs/specs/dashboard.md` and `docs/specs/pipeline.md`. The mockup shows the look, not the sample data: it has about 11 won deals, where the app has about 20. It's in light mode only. Dark mode keeps the same layout and uses the dark colors in `docs/specs/light-and-dark.md`.

## Fonts

Instrument Sans for headings and body. JetBrains Mono, with tabular figures, for money, counts, percentages and dates in tables, cards, tiles and charts. Instrument Serif is used only as an accent: for the tagline under the logo ("Every deal, accounted for") and the date above the dashboard's title.

| Use | Font | Size and weight |
|---|---|---|
| Page title | Instrument Sans | 28px, 600 |
| Panel title | Instrument Sans | 16px, 600 |
| Body and table cells | Instrument Sans | 14px, 400 |
| Labels and table headings | Instrument Sans | 13px, 500 |
| Small print | Instrument Sans | 12px, 400 |
| The dashboard's main figure | JetBrains Mono | 46px, 500 |
| Tile figures | JetBrains Mono | 26px, 500 |
| Pipeline column totals | JetBrains Mono | 17px, 500 |
| Card values | JetBrains Mono | 15px, 500 |
| Figures in tables and other places on cards | JetBrains Mono | 12 to 13px, 400 |
| Accent | Instrument Serif | 17px for the tagline, 22px for the date |

## Colors

**Colors in light mode.** Each contrast ratio is measured against white, and against the page background where text sits on it.

| Name | Value | Use |
|---|---|---|
| Sea Green | `#06D6A0` | Primary buttons (Midnight text, 6.4:1), Won, won charts, the active page in the sidebar |
| Sea Green text | `#037558` | Sea Green as text (5.7:1 on white, 5.1:1 on the page) |
| Marigold | `#FFC145` | Qualified |
| Marigold text | `#8C5E00` | Marigold as text (5.7:1, 5.1:1) |
| Coral | `#F78C6B` | Proposal |
| Coral text | `#C1350A` | Coral as text (5.6:1, 5.0:1) |
| Cerulean | `#118AB2` | New, the focus ring (4.0:1 against white, above the 3:1 needed) |
| Cerulean text | `#0E7191` | Links (5.5:1, 5.0:1) |
| Cerulean fill | `#0F789B` | Fills behind white text (5.0:1) |
| Raspberry | `#EF476F` | Dots and marks for late deals, overdue follow-ups and errors |
| Raspberry text | `#CD123F` | Late dates, overdue labels and error messages (5.6:1, 5.1:1) |
| Raspberry fill | `#D91342` | Delete buttons, with white text (5.1:1) |
| Midnight | `#073B4C` | Main text (12.1:1, 10.9:1), Negotiation |
| Slate | `#4F6873` | Secondary text, from Midnight (5.9:1, 5.3:1) |
| Grey | `#8FA3A9` | Lost; never for text |
| Field outline | `#7A9097` | The outline of inputs and selects (3.4:1) |
| Sea Mist | `#CDD8DB` | Not used in light mode. Main text and Negotiation in dark mode |
| Divider | `#E3EAEC` | Lines between table rows, chart gridlines |
| Page | `#F0F4F5` | Page background |
| Panel | `#FFFFFF` | Panels, cards and dialogs, and the raised surface for menus, lists, tooltips and messages |

Badge backgrounds are a 16% tint of each color on white, with Midnight text (9 to 11:1): Sea Green `#D7F8F0`, Marigold `#FFF5E1`, Coral `#FEEDE7`, Cerulean `#D9ECF3`, Raspberry `#FCE2E8`, Midnight `#D7E0E2` and grey `#EDF0F1`.

Statuses use colors too: lead Cerulean, qualified Marigold and customer Sea Green.

Components use colors by role, never by the brand's names or by value. The roles are:

- page, panel, raised, ink, ink muted, divider, field outline, focus and link
- primary, the text on primary, alert and their tints
- each stage and status, with its tint

Only the theme file maps each role to a color in the tables above and in `docs/specs/light-and-dark.md`, with one value for light mode and one for dark, and the charts use the same roles. The favicon can't read the theme, so its two colors are light mode's ink and primary values, which a test checks. It's the same in both modes.

## Surfaces and shape

- **Panels:** white, rounded (16px), with no outline and a soft shadow: `0 1px 2px rgba(7, 59, 76, 0.06), 0 8px 24px rgba(7, 59, 76, 0.06)`. In dark mode they're black on the dark teal page, and the shadows are black: `0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.4)`.
- **Cards** are rounded 12px, and **buttons and inputs** 10px.
- **Edges:** no border on one edge of anything, and no line across the top of the page or under the page header. A stage or status shows as a dot or a badge, never as a colored stripe down the side of a card.
- **Fills** are flat. There are no gradients. The line chart's area uses a flat tint.
- **Spacing** is on a 4px grid. Panels have 20 to 24px of padding, and the gap between panels is 20px.

## Components

- **Buttons** are 36px high, in 14px semibold:
  - Primary: Sea Green with Midnight text, in both modes.
  - Secondary: a Midnight tint with Midnight text, or Midnight with Sea Mist text in dark mode.
  - Delete: Raspberry fill with white text.
  - On hover, these three darken to 95% brightness, except a secondary button in dark mode, which lightens to 125%, since darkening Midnight barely shows.
  - Icon buttons are 32px square, with a label for screen readers and a tooltip.
- **Inputs:** white, with a full 1px outline in the field outline color. They're 36px high, with the label above and any error message below in Raspberry text. A ticked checkbox is Sea Green with a Midnight tick, in both modes.
- **Badges:** pill-shaped and 22px high, with a tint background, Midnight 12px medium text and an 8px dot in the full color.
- **Tables** sit inside a panel.
  - The headings are Slate text with no fill, and rows are 44px high with a divider between them.
  - A row is lightly tinted on hover.
  - Figures are right-aligned in JetBrains Mono.
  - Edit and Delete are always visible, not only on hover.
- **Due badges** on follow-ups: a Raspberry tint when overdue, a Marigold tint when due today, and grey otherwise.

- **Dialogs:** white and 520px wide, over Midnight at 40%, or Midnight at 70% in dark mode (concern 13).
- **Menus, select lists, pickers and tooltips** open on the raised surface, with the deeper shadow: white in light mode and Midnight in dark mode.
- **Messages:** on the raised surface at the bottom right. Errors have a Raspberry dot.

## Words and formats

Plain business English, short labels, no jargon and no exclamation marks.

- **Buttons** say what they do: "Add deal", "Log activity", "Save", "Delete organization", "Cancel".
- **Money:** `$12,500`, with USD in headings (concern 11). `$1.2M` and `$48K` only in tight spaces, with the full amount on hover.
- **Dates:** `Nov 22, 2026`. In timelines, "Today, 2:30 PM", "Yesterday, 9:05 AM" or "Nov 12, 2:30 PM", with the year added when it isn't this year.
- **Percentages:** `50%`.
- **Empty states:** one plain line and an Add button, such as "No organizations yet." Searches with no results say "No deals match "acme"."

## Layout

- **Sidebar:** a floating white panel, 224px wide, 16px in from the top, bottom and left of the window, and rounded with the panel shadow.
  - It holds the wordmark "Accountable" with its tagline, then the five sections, each with an icon. The logo mark beside the wordmark is a Sea Green dot in a Midnight circle, in both modes.
  - Organizations, Contacts and Deals show how many records they have, on the right in JetBrains Mono.
  - The current section is a Sea Green tint pill with Midnight text.

- **Main area:** on the page background, with 24 to 28px of padding and content up to 1440px wide.
- **Page header:** the title on the left, with the main action on the right, such as "Add deal".

## Keyboard and accessibility

Everything can be done with the keyboard as well as the mouse, including moving a card on the pipeline. Text meets WCAG AA contrast in both modes, and every form field has a label.

- **Tab order:** everything can be reached with Tab, in reading order. Everything that can be focused shows a 2px Cerulean focus ring, 2px outside its edge.
- **Structure:** a "Skip to content" link comes first. Each page has one main heading, which is the message when the page can't load, and labelled navigation and main areas.
- **Tables:** these are real HTML tables. Each sortable heading is a button and announces its sort order. On each row, the name link and the Edit and Delete buttons can be reached with Tab.
- **Forms:** every field has a visible label. Errors are linked to their field, and saving with errors moves focus to the first one.
- **Dialogs** keep focus inside them, close with Escape, and return focus to the button that opened them, or to the menu's button for an item in a menu.

- **Not by color alone:** stage, status, late and overdue are always written in words as well as shown in color.
- **Motion:** animations are turned off for anyone whose system asks for reduced motion.
