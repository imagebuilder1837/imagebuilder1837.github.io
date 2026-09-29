# Repository guidance

- This branch contains the Hexo source. The published site currently comes
  from `main`; do not change Pages settings or run deployment without explicit
  approval.
- `themes/clover` is a separate Git submodule. Commit theme changes in its
  repository, push the theme commit, then update and commit the blog's submodule
  pointer.
- Commit messages follow Conventional Commits.
- Issues are read-only by default. Create, edit, comment on, label, or close an
  issue only when explicitly requested or when the user invokes the relevant
  issue-writing skill.

## Agent skills

### Issue tracker

Use GitHub Issues in `imagebuilder1837/imagebuilder1837.github.io`,
including for tasks that change the theme. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout; create glossary entries and ADRs only when
needed. See `docs/agents/domain.md`.
