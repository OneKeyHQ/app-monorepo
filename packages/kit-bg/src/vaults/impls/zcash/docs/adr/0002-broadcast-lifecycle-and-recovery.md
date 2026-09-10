# ADR 0002: Broadcast lifecycle and recovery

- Status: Accepted
- Date: 2026-09-02

## Context

`pcztSend` finalizes a PCZT and stores the transaction in the local wallet
before the separate network broadcast. A process can crash between those two
steps, and a network timeout cannot prove whether the node accepted the bytes.
Treating every broadcast error as failure either loses recoverable transactions
or falsely tells the user that an accepted transaction failed.

## Decision

The lifecycle is:

| Observation | App state | Next action |
| --- | --- | --- |
| Node accepted, or reports already known | Pending | Wait for mining |
| Network result is unknown | Pending | Retry the same stored transaction |
| Node definitely rejects it | Failed | Persist the rejection; do not retry |
| Runtime observes a mined height | Confirmed | Mined state overrides older failure markers |

The runtime atomically stores the finalized transaction and its broadcast
intent before returning the txid. It also owns accepted/rejected state and the
recipient derived from its transaction-output view. History reads all private
transaction lifecycle facts from this database; SimpleDB is not a second
authority.

Before exposing a finalized txid, the runtime waits behind the IndexedDB VFS
commit queue. Any earlier asynchronous SQLite sync failure poisons that VFS
instance until it is reloaded; the App treats the finalization result as
unknown and must not release the reservation or broadcast from volatile state.

On sync, the runtime returns only its persisted retry candidates for every
account in the shared network database. The App deduplicates txids and asks the
runtime to retry them; it never infers broadcast intent from generic history.
This is also the crash-recovery path for a process death after local storage
but before the original broadcast response.

For private or mixed transactions, the backend may promote a runtime Pending
row only when it proves that the transaction is mined. Backend Failed, Dropped,
or Removed states cannot override the runtime lifecycle. Pure transparent
transactions remain fully backend-owned.

While a reservation, unsettled outgoing transaction, or unresolved broadcast
exists, Privacy Mode pause, local privacy-data deletion, runtime-cache reset,
and birthday rescan are blocked by the same background safety check. The UI
offers an immediate status refresh and otherwise says to retry in about 15
minutes. This is an estimate for the 10-block lock, not a wall-clock promise;
the operation becomes available as soon as reconciliation proves a terminal
state.

## Consequences

- A timeout must not be displayed as Failed.
- Duplicate/already-known node responses are idempotent success.
- A later mined observation always wins over a persisted rejection marker.
- Account deletion removes official wallet data and runtime lifecycle state in
  the same SQLite transaction.
- Legacy SimpleDB journals migrate into the runtime before the App deletes
  them. A journal entry missing from the wallet is guarded for one normal
  transaction-expiry window and then stops blocking new sends if scanning never
  observes it.
- Tests must cover accepted, unknown, definite rejection, duplicate-known,
  crash recovery, and Pending-to-Confirmed reconciliation.

## Alternatives rejected

- Broadcast before local storage: a crash after network acceptance would leave
  no local recovery record.
- Rebuild and resign on retry: it can select different notes or create a double
  spend instead of rebroadcasting identical bytes.
- Mark every exception Failed: network ambiguity is not a protocol rejection.
