# Bundle QA smoke test

Temporary fixture for validating the Slack Bundle QA message with the `release/v6.7.1` merge target.

Expected App Version: `6.7.1`.

Smoke check: verify that a new commit refreshes the Bundle QA status.

Repeat smoke check: verify that the next commit is picked up by the Bundle QA workflow.

Follow-up smoke check: verify that the QA status refreshes for this new head commit.
