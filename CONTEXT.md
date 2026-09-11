# Hardware Connection Domain

## Terms

- **Transport**: A connection channel such as USB or BLE. It is not the
  identity of the physical wallet.
- **Device identity**: A vendor-provided identity used to verify the physical
  wallet. Ledger uses a fingerprint; Trezor uses `device_id`.
- **Transport locator**: A value used to reach a device through one transport,
  such as a BLE MAC/connect ID. It is not sufficient proof of device identity.
- **Device selection**: Choosing which discovered hardware device should be
  used for the current business operation.
- **BLE binding**: Associating a verified physical device identity with a BLE
  transport locator for future direct connections.
- **Candidate**: A device observed during an active scan. Observing a candidate
  never connects or binds it automatically; the user must select it.
- **Binding session**: The user-controlled period during which BLE candidates
  may be discovered, selected, verified, and bound. It ends on success,
  cancellation, timeout, or closing the binding UI.
- **UI Request**: A request emitted by the SDK for the host application to
  render hardware interaction UI and return a user decision or platform result.

## Decisions

- USB and BLE discovery are serialized within one SDK-owned operation.
- BLE is considered only after USB discovery returns no candidates.
- A USB identity mismatch does not silently fall back to BLE; the user may
  continue scanning and select another candidate within the active session.
- BLE candidates are streamed to the UI. Even a single candidate is not
  auto-selected while scanning remains active.
- Ledger and Trezor use the same SDK-owned binding contract while retaining
  vendor-specific identity verification.
- The first Ledger identity anchor is the chain selected by the current
  business operation, not a globally fixed Ethereum identity.
- If that chain's Ledger app is missing, the SDK requests an explicit app
  installation UI step; installation is not silent and does not switch chains.
- The long-term target is a shared SDK binding contract for Ledger and Trezor;
  vendor identity verification remains separate.
