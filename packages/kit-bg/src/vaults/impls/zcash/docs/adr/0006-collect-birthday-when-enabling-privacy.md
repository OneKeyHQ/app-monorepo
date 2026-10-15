# Collect the Zcash birthday when enabling Privacy Mode

Status: accepted

Zcash birthday collection belongs to the Privacy Mode enable flow, not wallet onboarding, because transparent-only accounts never need to scan. The product asks only for month-level precision. For a mnemonic created by OneKey, the App records its creation month and recommends that month automatically; for an imported mnemonic, enabling privacy requires the user to choose an approximate month. The selected month is converted to a conservative block height and persisted. A previously saved birthday survives pause and deletion of local privacy data and is reused on re-enable.

The enable explanation warns that an account left unused for a long time may
need a lengthy catch-up scan when privacy is used again, and that private
balances remain unknown until that scan completes.
