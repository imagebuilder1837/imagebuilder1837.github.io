# GitHub Actions 与自动合并

- 由 `GITHUB_TOKEN` 引发的 push 不触发后续 push 工作流。参见[平台事件限制](https://docs.github.com/en/actions/concepts/security/github_token)。
- 仓库自动合并开关与既有 PR 自动合并请求分别管理；停用时还需撤销已开启的请求。
- Actions 的许可取决于实际适用、继承的事件与 actor 策略；`allowed_actions=all`、单层空策略列表或历史成功记录不是策略许可的充分证据。参见 [GitHub 安全说明](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)。
