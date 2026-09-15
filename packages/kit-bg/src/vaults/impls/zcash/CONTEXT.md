# Zcash Account and Payment Context

This context distinguishes account visibility, payment sources, recipient
capabilities, and transaction intent. These terms describe the product domain;
supported combinations and release scope belong in the product contract and ADRs.

## Language

### Accounts and visibility

**Transparent Mode**:
An account mode that exposes transparent funds and activity without enabling
local discovery of private funds. The mode name alone does not define the allowed
recipient address types.
_Avoid_: Transparent-destination-only account

**Privacy Mode**:
An account's opt-in capability to discover and display its supported private
funds and activity. Enabled capability does not mean historical discovery is
complete.
_Avoid_: Fully synchronized account

**Viewing Identity**:
The identity under which private activity can be discovered on a network.
Multiple App accounts may share a viewing identity while retaining independent
privacy-mode intent. It is the unit a scanning limit counts, so accounts
sharing one are counted once.
_Avoid_: App account, address, signing authority

**Birthday**:
The earliest point from which an account's supported private activity must be
searched to recover its history.
_Avoid_: Account creation time

**Privacy Pause**:
Stopping future private discovery and hiding the account's private surfaces
while retaining the materials and progress needed to resume. A paused account
still holds the cached discovery its viewing identity shares.
_Avoid_: Delete, erase

**Delete Local Privacy Data**:
Removing an account's locally discovered private data and the local record of
its viewing identity, including any local archive of what it signed. It does
not remove funds, public on-chain history, or the recovery point the account
would need to discover its private activity again.
_Avoid_: Pause, reset, log out

**Scan Pause**:
Temporarily stopping private discovery without changing an account's Privacy
Mode or hiding its cached private surfaces. It applies to a whole network
rather than one account, survives a restart, and a manual pause requires a
manual resume.
_Avoid_: Foreground boost pause, privacy-mode off

### Payment sources and recipients

**Transparent-source Payment**:
A payment funded by transparent outputs. Its source classification is distinct
from the recipient's address type and the pool receiving new outputs.
_Avoid_: Public-recipient payment

**Private-source Payment**:
A payment funded by one or more supported private pools. Its recipient need not
be private merely because its source is private.
_Avoid_: Payment to a Unified Address

**Unified Address (UA)**:
A recipient address that describes one or more supported receiving capabilities.
The receiving capability and the pool used for a new output are separate concepts.
_Avoid_: Ironwood address

**Shield All**:
Moving all eligible regular transparent funds of an account, less the fee, to
that account's own current private output pool. It does not consume existing
private funds or coinbase funds.
_Avoid_: External-UA payment, automatic shielding on enable

**Spendable Amount**:
The amount eligible to fund a payment under its chosen source, recipient,
confirmation, reservation, and fee constraints.
_Avoid_: Total balance

**Transparent-first Preference**:
An account preference allowing eligible transparent funds to fund a
private-recipient payment before the selected private source covers a shortfall.
_Avoid_: Automatic shielding, internal-only transparent spending

**Frozen Funds**:
Funds that are currently unavailable to spend under the applicable constraints.
Transparent funds that can be spent through the transparent source are not
frozen merely because private discovery is enabled.
_Avoid_: All non-private funds

### Knowledge and intent

**Scan Completeness**:
Whether the account's required historical range has been searched. A partial
search can discover funds without establishing that the resulting total is complete.
_Avoid_: Nonzero balance, enabled privacy mode

**Known Zero Balance**:
A zero value supported by the required balance observations. An unavailable or
incomplete observation is not itself evidence of a known zero.
_Avoid_: Not synchronized

**Broadcast Authorization**:
The user's intent to submit a particular signed transaction to the network.
Possession of a signature alone does not establish this intent.
_Avoid_: Signed transaction

**Unresolved Outgoing Transaction**:
An outgoing transaction whose acceptance, confirmation, rejection, or expiry
has not yet established the relevant terminal outcome. A missing network response
does not establish rejection.
_Avoid_: Failed transaction
