# Keyless deletion Web verification

Run from the repository root with OneKey App Web listening on port 3003.

```sh
yarn jest --runInBand apps/web/src/keylessDeletion
KEYLESS_APP_WEB_E2E_PORT=3003 node apps/web/e2e/keyless-deletion-prime.e2e.js
```

Jest covers invitation parsing, the configured official Prime origin, restrictions on OAuth PKCE exchange, API validation, error mapping, and request deadlines. Chrome checks the actual App Web route in isolated browser contexts. All external responses are intercepted. Invitations, codes, credentials, and results in the tests are synthetic.

- Verify initial invitation loading, Google and Apple callbacks, account mismatch, code entry, and confirmation.
- Verify uncertain, conflicting, and already submitted operations via the original result query.
- Verify all 19 App languages and Auto. Changing language keeps the URL fragment and the current operation and does not repeat an API request. App translations are used where appropriate. Deletion-specific copy without translation keys remains in Chinese.
- Verify that the page bootstraps without placeholder copy and displays the App spinner during the invitation request. Retrying a module load or invitation request preserves the invitation URL.
