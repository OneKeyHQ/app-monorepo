# Hardware Connection Domain

## Terms

- **Transport**: A connection channel such as USB or BLE. It is not the
  identity of the physical wallet.
- **Physical device identity**: A vendor-provided identity that verifies one
  physical unit. Ledger derives one per chain; Trezor reports one per device.
- **Wallet identity**: An identity derived from the seed rather than from the
  hardware. The same physical unit yields a different wallet identity under a
  different seed or passphrase, and one wallet identity is the same across
  every carrier the wallet can be reached on. Keystone is identified this way.
- **Air-gap protocol**: A wallet protocol whose messages are self-contained
  payloads exchanged without a live session. A payload may be carried by QR
  code or by cable; the carrier changes neither the protocol nor the wallet
  identity.
- **Transport locator**: A value used to reach a device through one transport,
  such as a BLE MAC/connect ID. It is not sufficient proof of device identity.
  A value that addresses a wallet identity is not a transport locator, even
  when it occupies the same field. Locators live in one column per channel, so
  the column name says which channel the value belongs to.
- **Device selection**: Choosing which discovered hardware device should be
  used for the current business operation.
- **BLE binding**: Associating a verified physical device identity with a BLE
  transport locator for future direct connections.
- **Candidate**: A device observed during an active scan. Observing a candidate
  never connects or binds it automatically; the user must select it.
- **Binding session**: The user-controlled period during which BLE candidates
  may be discovered, selected, verified, and bound. It offers the user two
  exits: plug in a cable and let the operation continue there, or bind a BLE
  locator. It ends on either exit, on cancellation, timeout, or closing the
  binding UI.
- **Search target**: A selectable entry point produced by one round of
  discovery. It proves neither a physical device nor a wallet; resolving what
  is behind it is the job of the connection that follows.
- **Interaction**: The runtime association between one business operation and
  the connection it selected. It lives only inside the running SDK, is never
  stored, and does not survive a restart. A new selection never inherits an
  earlier interaction.
- **UI Request**: A request emitted by the SDK for the host application to
  render hardware interaction UI and return a user decision or platform result.

## Decisions

- Transport selection belongs to the SDK, not the host application. The host
  does not arbitrate which channel a vendor's call travels on.
- USB and BLE discovery are serialized within one SDK-owned operation, at every
  connection stage and not only during binding.
- BLE is considered only after USB discovery returns no candidates. A cable is
  steadier than a radio link, and a wallet that is plugged in is either
  charging or about to be used; either way USB is the better first choice.
- When USB discovery does return candidates but none of them is the wallet the
  operation needs, the user is told they plugged in the wrong device and can
  swap it. This is not a silent fall back to BLE.
- A vendor that can establish, from discovery alone, that the target wallet is
  not present on USB may go to BLE without opening a session on unrelated
  devices. A vendor that can only establish it after connecting has to connect
  first. Which vendors can do this is a property of what discovery exposes, not
  of any particular stored field.
- Recognising a stored transport locator during discovery is not identity
  verification. It only narrows which devices are worth connecting to; the
  wallet identity is still verified after the connection is open.
- BLE candidates are streamed to the UI. Even a single candidate is not
  auto-selected while scanning remains active.
- Ledger and Trezor use the same SDK-owned binding contract while retaining
  vendor-specific identity verification.
- The first Ledger identity anchor is the chain selected by the current
  business operation, not a globally fixed Ethereum identity.
- Ledger does not open another chain's app to pre-verify identity when the
  target chain has no anchor yet. The first successful operation on that chain
  establishes its anchor.
- A wallet identified by wallet identity is one wallet across all of its
  carriers. QR and cable are two carriers of the same wallet, not two devices,
  and neither carrier is treated as a physical device identity.
- A device record keeps one locator column per channel. New records fill only
  those; the legacy single-locator column is left to old records, where it may
  hold either channel depending on how that wallet was first onboarded. Readers
  go through the one helper that folds a legacy value into the right channel,
  so nothing has to be migrated and no caller has to guess.
- A connector cached across adapter lifetimes is rebuilt when the adapter is
  reset, not reused. Resetting a connector drops the subscriptions the host
  installed on it, so a runtime that keeps the old object keeps a connector
  nobody is listening to: calls still succeed while device events stop
  arriving.
- By the time the host is asked to persist a binding, the SDK has already
  verified that the connected wallet is the one the operation expects. Whatever
  the host reports back at that point - no record, an inconsistent record, or a
  record that does not carry that identity - is a host-side problem. The user
  is warned that the binding was not saved, the operation continues, and the
  binding can be established again next time.
- A wallet that fails identity verification is refused earlier, before any
  binding is offered, and that does stop the operation.
- A connection indicator reports device presence attributed to a wallet through
  a locator learned during an earlier verified connection. A carrier that cannot
  be attributed to any wallet lights nothing.
- Presence is not the same as the wallet being loaded. Where one physical unit
  can hold several wallets, plugging it in lights every wallet known to live on
  it; the indicator answers "the unit this wallet lives on is here", not "this
  wallet is the one currently open".
- A derivation path a vendor cannot support is reported with an explicit
  reason. It is never dropped silently from a batch request, because a silently
  missing account is harder to explain than a refused one.
- If that chain's Ledger app is missing, the SDK requests an explicit app
  installation UI step; installation is not silent and does not switch chains.
- The long-term target is a shared SDK binding contract for Ledger and Trezor;
  vendor identity verification remains separate.

## Needs hardware to verify

Claims the code relies on that no test can settle, listed so they are checked
against a real device rather than re-derived from the code each time.

- **A Trezor's USB serial number equals its firmware `device_id`.** Onboarding a
  Trezor over desktop BLE stores the firmware `device_id` as the USB locator,
  while a real USB enumeration reports `device.serialNumber`. The locator is
  written once and never corrected, so if the two differ, that wallet's saved
  USB locator can never match and every later cable connection re-enumerates
  instead of reusing it — silently, because discovery just falls through to BLE.
  Check: onboard over desktop BLE, read the stored USB locator, then connect
  over USB and compare with the connectId discovery reports.
- **A THP credential minted over USB lets the same Safe 7 autoconnect over
  BLE.** Credentials are keyed by the device's static public key, so the
  protocol says they are transport-agnostic, and the fused desktop connector
  broadcasts a new credential to every sibling transport. Only desktop can
  exercise this, and only when both channels are used within one adapter
  lifetime. Check: pair over USB, unplug, connect over BLE, expect no pairing
  code.
- **A Safe 7 still matches during a Windows scan.** Its service UUID travels in
  the scan response rather than the advertisement, so discovery matches on the
  advertised name instead. That name test now travels to the main process as
  regular-expression data rather than running as a function; the patterns are
  equivalent on paper and in unit tests, but the advertisement content itself
  has only ever been confirmed on real Windows hardware.
- **A locked-but-bonded Safe 7 still reads as "unlock me" on Windows BLE.** The
  app used to tell a locked device (link up, GATT discovery fails) from a dead
  address (link never came up) by matching noble's Windows string "unreachable
  while discovering services"; that heuristic moved out of the app and has no
  equivalent in the SDK, where `BleConnectFailed` is classified uniformly as a
  transport error and lands in `RESCAN_DEVICE_ERROR_CODES`. A bonded Trezor
  does not advertise, so a rescan may report "device not found" instead of
  asking the user to unlock. Windows desktop only — the string comes from
  noble's Windows binding and never appears on macOS. Check: bond a Safe 7 over
  desktop BLE on Windows, lock it, then start an operation.
- **Picking one of several BLE Trezors no longer pops a pairing dialog for the
  wrong one.** `beginBindingProbe`/`endBindingProbe` suppressed the THP pairing
  dialog while probing a candidate that turned out not to be the target; both
  are gone from the app and the SDK, and the replacement design ("complete the
  handshake, then compare device_id") was not traced onto the bare
  `connectDevice` path that the probe uses. No automated test covers this any
  more. Check: two bonded Safe 7s in range, connect to one, expect no pairing
  prompt from the other.
- **A Ledger's BLE binding still gets pinned after the first operation on a
  chain.** The fingerprint anchor is persisted before the confirmation round
  trip, and a confirmation that fails to complete no longer discards the user's
  result. The cost is that the SDK never publishes the verified BLE binding for
  that chain, so the wallet stays in the weaker "unverified binding" mode
  indefinitely — a different device is still refused later by
  `_verifyDeviceFingerprintWithSession`, but the "known device fails closed"
  shortcut is missing and reselect/rediscovery may run every time. Check how
  often that confirmation actually fails on real BLE before deciding whether it
  needs a retry.
