# Local Ledger attestation server

This developer-only process owns Ledger's DMK `GenuineCheckDeviceAction`.
Desktop keeps its existing hardware session and forwards only APDU
request/response frames over WebSocket. The genuine verdict, physical-device
DSID, and DEV voucher are produced in this process.

```bash
yarn dev:ledger-attestation-server
```

The server listens on `127.0.0.1:49271` and exposes `GET /health` plus
`WS /v1/ledger/attestation`. It connects to Ledger's official secure-channel
backend, so internet access and the on-device `Allow secure connection`
confirmation are required.
