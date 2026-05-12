# DApp Connection

## Request Flow

- DApp requests arrive through JSBridge and `backgroundApiProxy.bridgeReceiveHandler`.
- Browser `WebView` can run `customReceiveHandler` before the default bridge handler.
- `ServiceDApp.openModal` serializes request source info into route params and opens modal screens.
- Extension DApp request windows are DApp infra, not browser module enablement.
- Background-thread requests without navigation ref emit `NavigateModalFromBackgroundThread`.

## Modal Rules

- `request.origin` and `request.scope` are required for DApp modals.
- Keep modal params serializable; `openModal` calls `ensureSerializable`.
- Do not pass sensitive clipboard text or secrets through route params. Follow the existing nonce map pattern in `openClipboardPermissionModal`.
- Use `fullScreen` consistently with existing flows: connection/custom network/custom token/sign transaction are full-screen on relevant platforms.

## Session Storage

- DApp sessions are stored in `simpleDb.dappConnection`.
- Storage type is `injectedProvider` for in-page providers and `walletConnect` for WalletConnect.
- `getQueryDAppAccountParams` derives `storageType` and `networkImpls`.
- `saveConnectionSession` removes conflicting existing sessions, persists image URL from `ServiceDiscovery.buildWebsiteIconUrl`, emits `DAppConnectUpdate`, records connected site, and may notify accounts after connect.
- `disconnectWebsite` updates WalletConnect when needed, deletes SimpleDB data, emits `DAppConnectUpdate`, notifies unless `beforeConnect`, and logs when `entry` exists.

## Account and Network Notifications

- `useDAppNotifyChanges` reconnects JSBridge when the active browser tab is focused.
- It throttles account/chain notifications and skips same-origin URL transitions.
- `notifyDAppAccountAndChainChangedWithCache` coalesces notifications for 2 seconds.
- Provider notifications are sent through `backgroundApi.sendForProvider(provider.providerName)`.

## Active Tab Interaction

- Switching active tabs should call `setCurrentWebTab`, not just set an atom.
- `setCurrentWebTab` pauses the previous tab and resumes the next tab's DApp interaction.
- Pause/resume toggles JSBridge `globalOnMessageEnabled`, reconnects the bridge, and patches webview WebSocket send behavior on native/desktop.

## Special Integrations

- Bitrefill messages are handled in `useDiscoveryMessageHandler`.
- Trust only exact allowed origins such as `https://embed.bitrefill.com`.
- Keep final user confirmation in signature/send modals as the last safety boundary for payment flows.
- Use BigNumber-safe send-building paths; do not parse on-chain amounts with floats.
