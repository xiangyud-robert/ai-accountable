# Review policy

Every change is reviewed against this policy before it merges. The reviewer reports its findings and doesn't change any code.

## Passes

Make a separate pass over every change for each of these:

- **Bugs:** the code does what it's meant to, including when something goes wrong.
- **Security:** no secrets or personal data are exposed, and nobody can do what they shouldn't.
- **Matches the spec and plan.md:** the change does what the spec and its own `docs/changes/<branch name>/plan.md` say, with nothing missing and nothing extra. The spec is `docs/spec.md` and the area files in `docs/specs/` that the change touches.
- **Described by the spec:** flag any code that does something neither `docs/spec.md` nor any area file in `docs/specs/` describes. Also flag a spec file the change affects but didn't update, including `docs/spec.md`'s summary and its index of areas, concerns and rules.
- **Follows STANDARDS.md:** the change's code follows `docs/STANDARDS.md`.

## Important

An Important finding must be fixed before the change merges. A finding is Important if the change breaks behavior that should work, leaks data or breaks a rule in AGENTS.md.

## Nits

A nit is a small point, such as style or naming, that doesn't block the merge. Report at most five per review.