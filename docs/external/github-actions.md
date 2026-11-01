# GitHub Actions 与自动合并

- 由 `GITHUB_TOKEN` 引发的 push 不触发后续 push 工作流，不能依赖它串联合并后的 CI 或发布。参见[平台事件限制](https://docs.github.com/en/actions/concepts/security/github_token)。
- 仅关闭仓库自动合并开关，不会主动撤销已开启的 PR 自动合并请求；仓库开关与单个请求需分别处理。
- Actions 的许可取决于实际适用、继承的事件与 actor 策略；`allowed_actions=all`、单层空策略列表或历史成功记录不是策略许可的充分证据。参见 [GitHub 安全说明](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)。
