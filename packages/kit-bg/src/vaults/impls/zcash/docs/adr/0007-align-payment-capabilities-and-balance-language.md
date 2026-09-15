# Align payment capabilities and balance language

Status: accepted, 2026-09-12 product alignment

Transparent-source payments may target transparent addresses or supported
Unified Addresses, provided signing requires neither a wallet scan nor scan
database initialization. Loading a stateless proof computation module is allowed;
it must not activate private discovery. A private recipient does not hide the
payment's transparent source. This replaces ADR 0005's initial external-UA
restriction and literal keys-module-only loading promise.

Transparent-first spending is a supported account preference, disabled by
default and applicable only to supported private destinations. The captured
preference must remain identical for review, quote, and transaction creation.
This supersedes the runtime glossary's internal-only interpretation.

Spendable transparent funds must not be described as frozen merely because the
account also has Privacy Mode enabled. Account presentation distinguishes total,
available, and unknown values; each transaction still applies its exact source,
recipient, confirmation, reservation, and fee constraints. An aggregate display
must not become an unrestricted input-selection budget.

OneKey hardware support is required in the current delivery, replacing its
future-work status. The companion SDK working tree already implements Zcash
methods; integration must consume matching built artifacts and verify the
supported device/protocol/firmware combinations. Hardware must cover both
transparent-to-transparent and transparent-to-supported-UA payments without
requiring Privacy Mode or scanning, in addition to Shield All and supported
private-source payments. This decision does not claim that an unverified device
combination or an unfinished send path is ready.

Privacy Mode and scan execution are independent controls. Enabling Privacy Mode
shows the scan-progress floating window, including a waiting state when cellular
permission prevents scanning. Its pause action stops scanning, not merely the
foreground speed boost; only an explicit manual resume may restart a manually
paused scan. Pausing scan execution does not turn off account Privacy Mode.
The scope and restart persistence of this pause are recorded separately once
confirmed. Cellular permission remains mandatory for any private scan on cellular.

These choices retain existing implemented capabilities while making their costs
and boundaries explicit. They do not authorize production rollout, firmware
installation, package publication, or funded transactions.
