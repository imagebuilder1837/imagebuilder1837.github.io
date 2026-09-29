# Issue tracker: GitHub

Specs and tickets for this effort live in
`imagebuilder1837/imagebuilder1837.github.io` GitHub Issues. Use `gh`.
Specify `--repo imagebuilder1837/imagebuilder1837.github.io` for `gh issue`
commands, including when working inside the theme submodule. For API calls,
use the same explicit owner/repo path.

Issues are read-only by default. A skill's instruction to publish a spec,
ticket, triage result, or wayfinder map authorizes only that requested
operation. Do not modify unrelated issues. Do not treat an external PR as an
issue-triage request; PRs as a request surface: no.

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read its body, labels, and comments.
Use full issue URLs when referencing work across the blog and theme
repositories; a bare `#number` is ambiguous.

## Wayfinding operations

A map is one issue labelled `wayfinder:map`. Its decision tickets are linked
as sub-issues where supported; otherwise use a task list on the map and
`Part of #<map>` in each ticket.

Use GitHub's native blocked-by dependencies where available. The dependency
API takes the blocking issue's numeric database `id`, not its displayed issue
number or `node_id`. If unavailable, record `Blocked by: #<number>` in the
ticket body and check blockers before claiming work. An unblocked, open,
unassigned ticket is on the frontier.

Wayfinder ticket types use `wayfinder:research`, `wayfinder:prototype`,
`wayfinder:grilling`, or `wayfinder:task`. Claim by assigning the ticket;
resolve by recording the answer, closing that ticket, and updating the map's
decision pointer. Perform these writes only when the user invokes the
corresponding workflow.
