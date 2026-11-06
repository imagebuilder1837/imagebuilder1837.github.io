# Repository guidance

- This branch contains the Hexo source. The published site currently comes from `main`; do not change Pages settings or run deployment without explicit approval.
- `themes/clover-evo` is a separate Git submodule. Commit theme changes in its repository, then update and commit the blog's submodule pointer.
- This personal blog uses one clean build and a lightweight generated-file/link check via `npm test`. Manually preview relevant pages for presentation changes.
- Add tests, broaden checks, or introduce testing infrastructure only with explicit user approval. Existing checks may be adapted to approved changes within their current scope, but explicitly notify the user of the changes and reasons.

## Agent skills

### Issue tracker

Use GitHub Issues in `imagebuilder1837/imagebuilder1837.github.io`, including for tasks that change the theme. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout; create glossary entries and ADRs only when needed. See `docs/agents/domain.md`.
