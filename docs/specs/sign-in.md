# Sign-in, people and the user menu

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

Who added and last changed each record is R17, in `docs/specs/records.md`. The theme choice in the user menu is in `docs/specs/light-and-dark.md`, and the search box beside the menu is in `docs/specs/search.md`.

## Concerns

18. **The stand-in sign-in.** `npm run dev`, the end-to-end tests and ui-check need someone signed in, without anyone's real password and without reaching Supabase. So the backend has a stand-in for Supabase's sign-in, which signs in as one of the made-up teammates in the sample data. The teammates have no Supabase accounts, so they can't sign in on the team's own Accountable.
    - The stand-in is on only when `ACCOUNTABLE_STAND_IN` is set, which `npm run dev` and the tests do. It's never set in `.env` or on Render.
    - The backend refuses to start, with a message, if the stand-in is on together with `SUPABASE_URL`, if it's on with a database that isn't SQLite, or if neither is set. A mistake in Render's settings then stops the app, instead of letting anyone in without a password, and the stand-in can never reach the team's data.
    - A stand-in token lasts 12 hours and isn't renewed. The backend makes the key that signs them when it starts and keeps it only in memory, so a restart of the backend also ends every stand-in session, and the next request shows "Your session has ended."
19. **People's names come from their tokens.** The publishable key can't read other people's details from Supabase, and the backend has no secret key. So the backend keeps its own list of the people who have used the app, in the users table. It adds someone the first time they use the app, and updates their email and display name whenever their token carries new ones. A display name set in Supabase's dashboard shows once their token is next renewed, which happens at least every hour while they use the app. Someone removed from Supabase stays in the list, so what they added still shows their name.
20. **Removing someone takes up to an hour.** The backend checks each token itself, against the Supabase project's public signing keys, rather than asking Supabase on every request, so requests stay quick and don't wait on Supabase. A token lasts an hour, Supabase's default. So someone removed or blocked in Supabase's dashboard can carry on until their current token runs out, at most an hour, and is then signed out.

## Rules

- **R15.** Only someone signed in can use Accountable.
  - Signed out, every page shows the sign-in screen, whatever its address.
  - Signed out, every address under `/api` answers 401, whether or not it exists, before anything else is checked. The one exception is the stand-in's sign-in, on this computer only (concern 18).
  - The backend checks the token on every request and takes the person from it, never from anything else in the request.
- **R16.** A person shows by their display name, the `display_name` in their user metadata in Supabase, or by their email until one is set. A display name that's only spaces counts as not set. Their initials are the first letters of the first two words of that name, in capitals, such as DH for Dana Holt, or the first letter of the email when there's no display name.

## Who can use it

- **People are added in Supabase's dashboard,** with an email and a password. Sign-ups are turned off in Supabase, and Accountable has no sign-up page and no password reset.
- **The Supabase project signs its tokens with an asymmetric key,** set under JWT Keys in its dashboard. The backend has no secret, so it can check only tokens it can verify with a public key. A project still on the legacy shared secret would refuse everyone.
- **Everyone can do everything.** There are no roles: everyone signed in sees and changes the same organizations, contacts, deals and activities.
- **The made-up teammates** in the sample data, listed in `docs/specs/sample-data.md`, can sign in only through the stand-in, on this computer (concern 18).

## Sign-in screen

- It shows at whatever address was opened, so signing in shows that page, such as a deal someone shared a link to. There's no separate sign-in address.
- It has the title "Sign in", an Email field, a Password field and a "Sign in" button. Below the panel, a line of small print says "No account yet? Ask whoever set up Accountable for your team to add you."
- While it signs in, the button says "Signing in..." and can't be pressed again.
- A wrong email or password shows "Wrong email or password." above the button, and the password field is cleared. Only Supabase's answer for wrong details, a 400, counts as this.
- If Supabase can't be reached, or answers with any other error, such as too many tries, it shows "Can't reach the sign-in service. Check your internet connection, then try again." The password is kept.
- With the stand-in on, the small print says instead "On this computer, sign in as a sample teammate, such as dana.holt@example.com, with the password accountable." The stand-in takes any teammate's email, in any case, with that password, and refuses anything else with the same "Wrong email or password." If the backend can't be reached, or answers with an error, the screen shows the app's usual "Can't reach Accountable's server. Check that it's running, then refresh."
- After a session ends, "Your session has ended. Sign in again to carry on." sits under the title, in Slate.
- The screen follows the theme saved in the browser (concern 14), and shows no sidebar, top bar or data. Signed out, the app sends no API requests at all.

## Staying signed in and signing out

- **Staying signed in:** the browser keeps the session, so a refresh or a restart of Chrome keeps the person signed in, and the token is renewed before it runs out. The session is one of the two things the browser keeps (R14).
- **On load,** while the browser checks its saved session, the page shows only its background, so someone signed in never sees the sign-in screen flash. Signed in, the app shows once `GET /api/me` has given the person and the team's time zone. If that can't be reached, the page shows "Can't reach Accountable's server. Check that it's running, then refresh." as its main heading.
- **A session that ends** while the app is open, because the backend refuses the token or it can't be renewed, shows the sign-in screen with "Your session has ended. Sign in again to carry on." Signing in again returns to the same page. Anything typed in a form that wasn't saved is lost. The session ends in the browser too, so a reload afterwards shows the sign-in screen without the message. Signing out of Supabase in another tab ends the session in this one, with the message.
- **Sign out,** in the user menu, ends the session in this browser only, not on the person's other devices, and works without a connection. It shows the sign-in screen. Nothing from the session stays on screen or in the page's memory, so the next person to sign in on that browser sees only what the server sends them.

## The user menu

The initials button at the right of the top bar opens the user menu. From the top, it holds:

1. The person's name in semibold and, beneath it, their email in small print. Someone with no display name shows their email once.
2. "Theme", with Light, Dark and System (`docs/specs/light-and-dark.md`).
3. "Sign out", with a log-out icon.

## Components

- **Sign-in panel:** a white panel, 400px wide, with 24px of padding, the page title, the two fields and the "Sign in" button as a primary button across the full width. The error message is in Raspberry text with a Raspberry dot.
- **Initials button:** a 36px circle in the secondary button's colors, a Midnight tint with Midnight text, or Midnight with Sea Mist text in dark mode, with the initials in Instrument Sans, 13px, 600. On hover it changes as a secondary button does. Its tooltip gives the person's name.
- **User menu:** opens below the initials button, lined up with its right edge, on the raised surface with the deeper shadow, 240px wide. A divider in the divider raised color (`docs/specs/look.md`) separates the name and email, the theme and Sign out.

## Layout

- **Sign-in screen:** on the page background, a column centered in the window: the logo mark, wordmark and tagline, centered, as in the sidebar, then the sign-in panel 24px below them, then the small print 16px below the panel.
- **The initials button** is at the right of the top bar, described in `docs/specs/look.md`.

## Keyboard and accessibility

- **Sign-in screen:** the Email field has focus when the screen shows. Enter in either field signs in. The fields are labelled, with `email` and `current-password` autocomplete so Chrome can fill them in. The error message, and the line saying a session has ended, are announced when they appear. After a wrong password, focus moves to the emptied password field. The screen is one main area, with the panel a region named by its heading, "Sign in", the screen's one main heading. The page's title is "Sign in - Accountable".
- **Initials button:** reached with Tab after the search box. A screen reader announces it as "Account, Dana Holt, DH", a button that opens a menu. The name ends with the initials it shows, so someone using speech control can say what they see (WCAG 2.5.3, label in name). With no display name, it's "Account, sam@example.com, S". Enter, Space or Down opens the menu, with focus on its first item, Light.
- **User menu:** Up and Down move through Light, Dark, System and Sign out, Enter or Space chooses, and Escape closes it and returns focus to the initials button. Tab stays in the open menu, and a click outside closes it. A screen reader announces the theme items as a group of three choices, with the chosen one checked.
- **Not modal:** while the menu is open, the rest of the page stays there for screen readers. A modal menu would hide the page's links and buttons from them while they could still take focus.

## How it fits together

- **In the browser:** the frontend signs in with Supabase Auth, using the project's URL and publishable key and nothing secret. Supabase's client keeps the session in the browser and renews the token. It never takes a session from the page's address, so a link can't sign someone in. Every API request sends the token as `Authorization: Bearer ...`. A 401 from the API ends the session (see Staying signed in).
- **In the backend:** one check runs before every route. It reads the token and checks that Supabase signed it, using the project's public signing keys; that it hasn't run out; and that it's for a signed-in user. It then takes the person's id, email and display name from it, refusing a token without an id or an email, and adds or updates them in the users table (concern 19). Every route gets the person from this check alone.
- **Supabase's keys:** the backend fetches them from `SUPABASE_URL/auth/v1/.well-known/jwks.json`, sending the publishable key with the request, and keeps them. It fetches them again once they're five minutes old, or for a token naming a key it hasn't seen, at most every 30 seconds, so Supabase can change its keys and a stream of made-up tokens can't flood it with requests. A key must sign with a public-key algorithm, never a shared secret or none. If it can't fetch them, the API answers 503 with "Can't reach the sign-in service. Try again in a moment." rather than 401, so a moment without Supabase doesn't sign anyone out, and the page shows its usual "Can't reach Accountable's server" message.
- **With the stand-in** (concern 18), the frontend sends the email and password to the backend's stand-in route instead of Supabase. The backend gives back a token for that teammate, signed with a key of its own, and the same check accepts it in place of Supabase's. The frontend uses the stand-in when it was built without the Supabase settings, as in `npm run dev` and the tests.

## Data model

**users**: everyone who has used the app, and the made-up teammates.

| Column | Type | Rules |
|---|---|---|
| id | text, the primary key | the person's Supabase user id; made up for the sample teammates |
| email | text | from their token, up to 254 characters |
| display_name | text, nullable | from `display_name` in their user metadata, up to 120 characters; empty until one is set |

People are never deleted by the app (concern 19). The four kinds of record link to this table through `created_by` and `updated_by` (R17).

## API

| Method and path | What it does |
|---|---|
| `GET /api/me` | The signed-in person: their id, name, email and initials (R16), and the team's time zone (concern 16). The zone is empty when `ACCOUNTABLE_TIMEZONE` isn't set, and the browser then uses its own. |
| `POST /api/stand-in/sign-in` | With the stand-in on only: `{ "email": ..., "password": ... }` for a sample teammate gives back a token and when it runs out, 12 hours later, and anything else 401 "Wrong email or password." (concern 18). An email over 254 characters or a password over 200 is a 422, which the sign-in screen shows as "Wrong email or password." With the stand-in off, this address doesn't exist. |

Without a valid token, every route answers 401 with "Sign in to carry on." and a `WWW-Authenticate: Bearer` header (R15).

## Testing hooks

- `ACCOUNTABLE_STAND_IN` turns on the stand-in sign-in (concern 18). The end-to-end tests and ui-check sign in through it as a sample teammate, through the same sign-in screen.
- The stand-in keeps its token in local storage under `accountable-stand-in-token`. The end-to-end tests spoil it to end a session.
- The end-to-end tests sign in as Dana once, through the sign-in screen, and every test starts with that saved session. The session, and Playwright's traces of failed tests, hold stand-in tokens, so both are saved outside the repo, in a folder in the computer's temporary folder named `accountable-e2e-` and 8 characters worked out from the repo's path. gitleaks scans git-ignored files too, and its `jwt` rule would take a token for a leaked secret. A token there is worthless once the run's backend stops.
- The backend's tests of the Supabase token check use tokens signed with a key pair of the tests' own, whose public key takes the place of Supabase's, so they never reach Supabase.
