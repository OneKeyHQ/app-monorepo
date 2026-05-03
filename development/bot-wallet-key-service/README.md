# BotWallet Key Service (PoC v1)

Local Node.js service for OneKey BotWallet CLI **remote key protection PoC**.

> **PoC scope only.** Not for production. See
> `_bmad-output/bot-wallet-export/project-context.md` §3 for the binding
> security rules.

## What it does

Holds the random AES-256-GCM key used to decrypt a single BotWallet credential
on a developer machine. The CLI must round-trip to this service every time it
needs to sign — no offline decryption is possible without it.

## Endpoints (v1)

| Method | Path                                | Body                  | Response                          |
| ------ | ----------------------------------- | --------------------- | --------------------------------- |
| POST   | `/v1/bot-wallet-keys`               | `{ keyBase64 }`       | `{ keyId, accessToken }`          |
| GET    | `/v1/bot-wallet-keys/:keyId`        | (Bearer access token) | `{ keyBase64 }`                   |
| POST   | `/v1/bot-wallet-keys/:keyId/revoke` | (Bearer access token) | `{ revoked: true }`               |

All other paths/methods return `404 { error: 'NOT_FOUND' }`.

## Trust boundary

The service **never** receives or persists ciphertext, mnemonics,
`IBip39RevealableSeed`, `walletId`, `displayAddress`, or `sourceLabel`. The
register body is strictly `{ keyBase64 }` — anything else → `400 INVALID_BODY`.

Persistence file `data/keys.json` only ever contains:

- `keyBase64`
- `accessTokenSha256` (never the plaintext token)
- `createdAt`
- `revokedAt?`

## Run

```bash
cd development/bot-wallet-key-service
yarn install
yarn start          # tsx src/server.ts → listens on 127.0.0.1:8787
yarn test           # jest
```

The host/port are **hard-coded** to `127.0.0.1:8787` (loopback only). Do not
expose this service on `0.0.0.0` or behind a tunnel.

## PoC e2e hand test

The CLI hand-test script starts this service, simulates an App export payload,
imports it through `onekey auth login --payload`, checks `auth status` and
`get-address`, runs five real sign calls, verifies they used one service fetch,
runs a fake-time TTL refresh sign, logs out, verifies service revoke, verifies
`vault.enc` removal, and runs the persistence audit.

```bash
ONEKEY_E2E_SIGN_TX='{"nonce":"0x0"}' \
ONEKEY_E2E_SIGN_ADDRESS='0x...' \
ONEKEY_E2E_SIGN_PATH="m/44'/60'/0'/0/0" \
ONEKEY_E2E_SIGN_PUB='0x...' \
ONEKEY_E2E_ALLOW_REAL_KEYCHAIN=1 \
bash apps/cli/scripts/e2e-poc.sh
```

The script intentionally requires `ONEKEY_E2E_ALLOW_REAL_KEYCHAIN=1` because it
uses the real CLI entrypoint and the real OS keychain account
`bot-wallet/master-key`. Run it only on a disposable dev profile or after
backing up any active CLI session. If the default simulated seed does not match
your sign inputs, set `ONEKEY_E2E_REVEALABLE_SEED_JSON` to the revealable seed
JSON that corresponds to those address/path/pub values.

## Zero runtime deps

`package.json.dependencies` must remain empty (or absent). The service uses
only Node 22+ built-ins (`http`, `crypto`, `fs`). Adding any runtime dep
violates NFR45 and breaks the PoC's "easy to audit" property.
