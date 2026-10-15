# ADR 0002: Broadcast lifecycle and recovery

- Status: Accepted; amended 2026-09-27 (see Amendment)
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

Ownership follows visibility, not privacy: the question is whether the
transaction has a transparent leg. A transaction that has one -- pure
transparent or mixed -- is indexed by the backend, so the backend row is the
row, including its Failed, Dropped and Removed states; the local scan only
attaches the shielded pools the backend cannot see. A fully shielded
transaction never appears in that index at all, so the backend has nothing to
say about it: its silence is absence of knowledge, not evidence of failure, and
the runtime owns that lifecycle alone.

While a reservation, unsettled outgoing transaction, or unresolved broadcast
exists, Privacy Mode pause, local privacy-data deletion, runtime-cache reset,
and birthday rescan are blocked by the same background safety check. The UI
offers an immediate status refresh and otherwise says to retry in about 15
minutes. This is an estimate of a normal confirmation, not a wall-clock promise;
the operation becomes available as soon as reconciliation proves a terminal
state.

## Consequences

- A timeout must not be displayed as Failed.
- Duplicate/already-known node responses are idempotent success.
- A later mined observation always wins over a persisted rejection marker.
- Account deletion removes official wallet data and runtime lifecycle state in
  the same SQLite transaction.
- Tests must cover accepted, unknown, definite rejection, duplicate-known,
  crash recovery, and Pending-to-Confirmed reconciliation.

## Alternatives rejected

- Broadcast before local storage: a crash after network acceptance would leave
  no local recovery record.
- Rebuild and resign on retry: it can select different notes or create a double
  spend instead of rebroadcasting identical bytes.
- Mark every exception Failed: network ambiguity is not a protocol rejection.

## Amendment (2026-09-27): broadcast before recording

Recording first meant the upstream wallet treated the spent notes as gone from
that moment, and only expiry (about 40 blocks) could free them. A transaction
the node explicitly rejected therefore froze the funds for most of an hour,
with nothing the user could do.

`pcztSubmit` now extracts the transaction, broadcasts it, and then records it
unless the node explicitly rejected it:

| Observation | Recorded | Notes |
| --- | --- | --- |
| Node accepted | Yes, accepted | Held by the transaction |
| Network result is unknown | Yes, pending | Held; the sync loop rebroadcasts |
| Node definitely rejects it | No | Released at once; the node's reason is shown |

The rejected-alternative above no longer holds as stated. A crash after the
node accepted but before recording leaves the reservation's persisted input
locks in place. Those locks last one block past the transaction's own expiry
(41 blocks past its target height), so the notes cannot be selected again while
the transaction can still be mined, and the scan records it once it is. Recording failures after
a broadcast are reported as FINALIZE_OUTCOME_UNKNOWN, as before.

Deleting an app account is not blocked by an unresolved transaction either:
the runtime removes a deleted account's data regardless (`removeDeletedAccount`),
unless another app account still uses the same viewing key. App reset deletes
the whole database the same way. The blocks above still apply to pause, local
privacy-data deletion, cache reset and rescan.

New sends are not blocked either, as in Zashi: an unresolved transaction's
notes are spent or locked and its transparent inputs are skipped, so a new
send cannot pick them again.
