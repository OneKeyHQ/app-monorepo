# Separate Zcash transparent and privacy account modes

Status: accepted

OneKey will model Transparent Mode and Privacy Mode as distinct account capabilities rather than treating shielded support as an always-on extension of every Zcash account. Transparent Mode uses OneKey backend data and a stateless Zcash signer without WalletDb or scanning; Privacy Mode is opt-in for supported accounts and activates UFVK-based local scanning. Pausing Privacy Mode retains its rebuildable cache and birthday, while deleting local privacy data is a separate destructive action that retains birthday for recovery. This boundary prevents UI-only disabling from continuing to use a viewing key in the network-shared runtime and allows transparent accounts to avoid loading the wallet runtime.

There is no persisted chain-wide switch and no compatibility migration while the feature remains under development. The network scheduler runs exactly when at least one privacy identity is enabled. Product intent and birthday belong to the App database per account, while the Rust database owns only deduplicated, rebuildable scan state per `(network, UFVK)`. Multiple enabled accounts may share that scan state without forcing disabled aliases or transparent watch-only accounts to display private data.

The App is the only authority for enablement. Every scan call supplies the
exact active UFVK set, and the runtime builds trial-decryption keys only for
that set; the Rust database does not persist a second active/inactive flag.
Account aliases keep independent UI intent while sharing one deduplicated scan
cache, and shared cache deletion is refused while another enabled alias still
references it.

The upstream scan queue is network-wide rather than per account. Pausing one
identity while another advances that queue therefore records a host-owned
resume height. If historical backfill was complete at pause, re-enable
requeues from the paused tip with reorg safety; otherwise it requeues from the
account birthday. The identity becomes active only for that catch-up scan and
subsequent work, preventing gaps without persisting product intent in Rust.

Transparent reads load no Zcash WASM. Transparent software signing lazily loads only the keys runtime for the current process or WebEmbed lifetime; it must not initialize the wallet runtime. App builds expose no Zcash testnet network, although isolated runtime automation may use testnet directly. Normal App acceptance uses mainnet.

The initial Transparent Mode send surface is deliberately limited to transparent-address inputs and transparent-address destinations. It does not silently select a Unified Address's transparent receiver and does not construct external Ironwood outputs. Moving the account's own transparent funds into Ironwood remains the explicit Shield All action after Privacy Mode is enabled; enabling Privacy Mode itself never creates or broadcasts a transaction.

When Privacy Mode is off, Orchard and Ironwood remain visible as feature-discovery surfaces, but they expose no cached balances, histories, receive addresses, or transaction actions. They show the account-level enable control and explain that private assets become visible and spendable only after enabling and synchronizing.
