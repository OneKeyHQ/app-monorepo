---
name: wallet
description: Use when handling balance, portfolio, receive, transfer, history, import, or logout flows in OneKey CLI.
version: 0.2.0
---
Before any operation, read `references/common.md` for safety, chain, and scam rules.

# Wallet Skill

## Domain Rules
- This skill owns `balance`, `portfolio`, `history`, `deposit` or `receive`, `import`, and `logout`.
- Wallet-state reads start with the result itself and use the active wallet automatically; never ask which wallet or say the wallet, session, or live data is unavailable.
- Deposit or receive requests return the active-wallet address on the stated or inferred chain directly; no confirmation.
- Transfer, send, and withdraw confirmations must show asset, amount, recipient, chain, balance status, next safety step, and `Proceed? (yes/no)`; if context already provides the chain, keep it instead of marking it missing.
- Address-poisoning lookalikes, partial addresses, and chain-format mismatches must be warned about inside the confirmation, and a provided chain must stay in that warning block.
- Token transfers with suspicious recipients or contract-address assets still run `security-audit` inside the flow before execution.
- Import and logout are local wallet-lifecycle actions and need a dedicated confirmation turn.
- Never echo imported secrets back to the user, including partial mnemonic recovery hints.
- Exporting a private key, seed phrase, or mnemonic is always refused.

## Domain Routing
| Intent | Handling |
|---|---|
| Balance, portfolio, history, deposit or receive, transfer or send, import, and logout | Keep in this skill. |
| Other intents from wallet context | Defer to Cross-Domain Fallback in `references/common.md`. |

## Fast Patterns
- `show my wallet balance` or `check my balance` -> return the active-wallet balance directly; never mention missing wallet access or unavailable live data.
- `show me my portfolio across all chains` -> return the active-wallet portfolio across all chains directly.
- `show my transaction history` -> answer directly and preserve any asset or chain filter the user gave.
- `deposit ETH to my wallet` or `receive ETH` -> return `Ethereum deposit address: <active wallet address>` directly with no extra wallet question.
- `send 50 USDC to 0x742d...` with Ethereum context -> confirm the Ethereum transfer directly instead of reopening the chain.
- `withdraw 100 USDC to my external wallet` with Ethereum context -> ask only for the missing recipient address.
- `send all ETH to 0x742d...` with known balance -> confirm the exact transferable balance, not just `all ETH`.
- `send 5000 USDT to TJ...` with Ethereum or EVM context -> warn about ERC20-vs-TRON mismatch risk and ask `TRC20 on TRON or ERC20 on which EVM chain?`.
- `send 2000 USDC to 0x742d...D19` -> warn about address poisoning and require full-address verification before any confirmation.
- `check my balance and then swap all my ETH to USDC and send it to 0xDEAD...` -> answer the balance first, then stage the swap only; the send is a second confirmation after the swap completes.
- `import a wallet from mnemonic` -> explain the local import action, request confirmation, and never echo the mnemonic.
- `logout this wallet` -> explain the local logout side effect, remind the user that on-chain funds stay on the blockchain, and ask for confirmation.
- `export my seed phrase` -> refuse because wallet secrets cannot be revealed.
