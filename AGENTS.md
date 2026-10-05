# Repository guidance

- This branch contains the Hexo source. The published site currently comes
  from `main`; do not change Pages settings or run deployment without explicit
  approval.
- `themes/clover-evo` is a separate Git submodule. Commit theme changes in its
  repository, push the theme commit, then update and commit the blog's submodule
  pointer.
- Commit messages follow Conventional Commits.
- Issues are read-only by default. Create, edit, comment on, label, or close an
  issue only when explicitly requested or when the user invokes the relevant
  issue-writing skill.

- Audit usage and impact, then obtain explicit approval before removing,
  replacing, or upgrading direct dependencies.
- Obtain explicit approval before changing remote auto-merge, branch protection,
  or Actions policies; local checks do not establish remote enablement or acceptance.

## Validation and documentation

- This personal blog uses one clean build and a lightweight generated-file/link
  check via `npm test`. Manually preview relevant pages for presentation changes;
  keep production validation and workflow safety guards intact.
- Add tests, broaden checks, or introduce testing infrastructure only with explicit
  user approval. Existing checks may be adapted to approved changes within their
  current scope, but explicitly notify the user of the changes and reasons.
- Document only currently useful constraints, reasons, and operational pitfalls
  that cannot be easily recovered from code. A short installation entry is allowed.
  Keep each rule in one place; remove implementation summaries and obsolete history.

## Agent skills

### Issue tracker

Use GitHub Issues in `imagebuilder1837/imagebuilder1837.github.io`,
including for tasks that change the theme. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout; create glossary entries and ADRs only when
needed. See `docs/agents/domain.md`.
