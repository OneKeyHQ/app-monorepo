# Home NativeList parity contract

Scope: iOS and Android Home NFT and full History tabs. Native UI resources belong to the main runtime; background business data is serialized through the existing service proxies. Web/desktop/extension and RecentHistory/plainMode are unchanged.

## Delivery boundary

The first milestone uses native pager discovery of the existing virtualized React list scroll hosts. It preserves all rows while removing the old collapsible-tab dependency. This is an intermediate milestone, **not** NativeList migration completion. Final migration requires the capabilities below on both native platforms, corresponding application mapping, and device acceptance.

## NFT mediaTile

Source: `packages/kit/src/views/Home/components/NFTListView/{index.tsx,NFTListItem.tsx}`, `packages/kit/src/components/NFT/hooks/useNFTMediaFallback.ts`, `packages/shared/src/utils/nftUtils.ts`.

- Grid columns follow 2/3/4/6/7 responsive breakpoints, including iPad. Tiles retain square media, collection subtitle, NFT title, optional network icon and ERC-1155 quantity badge (including capped quantity).
- Media must probe the existing `getNFTMediaProbeOrder(uri)` sequence. Both image and non-autoplay muted video work. Failed candidates advance; recycled identities cancel old callbacks. Terminal failure renders the image fallback. Generic media contract may expose `media: {uri, probeOrder, muted, autoplay}`, while preserving existing `image` compatibility.
- Network/account/collection/item identity controls row keys. Search uses `getFilteredNftsBySearchKey`; presses preserve current NFTDetails parameters.
- Loading/empty/search states and refresh are list-container capabilities, not extra tile types.

## History activity presentation

Source: `packages/kit/src/components/TxActionListView/index.tsx`, `packages/kit/src/components/TxAction/{TxActionCommon,TxActionTransfer,TxActionTokenApprove,TxActionFunctionCall,TxActionUnknown}.tsx`, `packages/kit/src/components/TxHistoryListView/{TxHistoryListItem,TxHistoryAddressInfo,SpeedUpAction}.tsx`.

Map the first `getDisplayedActions` result exactly as the existing renderer does. Do not infer network-specific or transaction-specific semantics in NativeList.

Required generic activity slots:

1. Leading visual, including paired token images, NFT square images, network overlay, fallback icon. Existing `LeadingVisual` is reused.
2. Title with inline badges/status decoration (risk/KYT, replacement/cancellation/failure). Existing risky-row opacity applies.
3. Description with optional prefix, icon, address label badge, and formatted timestamp. Business address labels are resolved by the application.
4. Amount lines: ordered `[{key,text,textSegments?,leading?,tone?,secondaryText?}]`, with style slots for primary/secondary lines. The existing phone rendering commonly has two lines; iPad `tableLayout` can render up to `MAX_DISPLAYED_TRANSFERS` plus overflow. Rows must measure variable height; amounts must not be silently capped at two.
5. Optional fee column (table layout), with primary native-fee and secondary fiat value. Explicit layout presentation (`stacked`/`table`) comes from the application.
6. Footer action groups with action keys, localized labels, tone, enabled/busy state. Actions preserve independent hit testing and must not trigger row navigation.

Transfer mapping fixtures required:

- send, receive, send-to-self, NFT transfer, multi-token and mixed direction;
- UTXO payload send/receive with nativeAmount netting and count-address labels;
- zero-address mint/burn endpoint exclusion;
- private-send recipient override and separate token-account creation fee;
- internal swap, internal staking and server action labels;
- hidden balances, positive/negative tones, small-number digit runs;
- approval, revoke, increase allowance, infinite allowance (including non-finite increase);
- function call and unknown action fallback;
- risky/scam opacity, KYT badge/watch-only suppression;
- pending, confirmed, failed, replaced and cancelled display status.

Pending-only application controller must reuse `useReplaceTx`: speed up, cancel, speed-up cancellation, check acceleration order status, and their eligibility. `SpeedUpAction` includes Bitcoin-specific behavior and must be preserved. A generic footer button is insufficient if its dispatch bypasses that controller.

## Container chrome and scrolling

Source: `packages/kit/src/components/NotificationEnableAlert.tsx`, `packages/kit/src/components/TxHistoryListView/index.tsx`, `packages/kit/src/components/Empty/EmptyHistory.tsx`, `packages/kit/src/views/Home/pages/hooks/{useFrozenTopHistoryData.native,historyTopFreezeUtils}.ts`.

- Scroll header: notification info banner, enable action opening notification settings, dismiss action persisting the existing scene atom; only show when server settings were loaded and push is disabled.
- Empty state: illustration/title/description and explorer action; respect hideBlockExplorer and merged-derive address selector. Search/loading states remain distinct.
- Scroll footer: loading spinner, full-history description, explorer button with native action anchor for derived-address selection. End-reached respects hasMore and in-flight guards. A fixed footer is not equivalent.
- Date sections retain pending-group confirming state, localized today/yesterday/date title, existing grouping and non-sticky section headers.
- Top insertion hysteresis: engage >160 logical points, release <48; native event emitted only on state transitions, enabled gate reevaluates current offset. iOS logical offset includes pager contentInset. Identity/focus resets retain `useFrozenTopHistoryData` behavior.
- Refresh preserves all-platform native control and iOS 65-point overscroll-on-release fallback with one deduplicated refresh dispatch.
- Header/footer/empty state/section headers/refresh belong to the list container. No arbitrary React row escape hatch and no Home transaction semantics in native code.

## Acceptance

For each capability, both iOS and Android require live interaction validation, not only snapshot/type checks. Compare the same fixture data and account identity before/after. Include iPad column/layout changes, dynamic type, pending action taps, list pagination, background insert while away, return to top, identity switch, short/empty list refresh, nested pager boundary handoff and notification height changes.

## Application handoff state

- `NFTListView/index.native.tsx` now mounts NativeList (`grid`) with media probe descriptors, responsive 2/3/4/6/7 columns, native refresh, quantity/network badges, search and original empty/loading React container slot. The default module is untouched.
- `HomeHistoryListView/NativeHistoryList.tsx` now mounts NativeList (`sectioned`), preserves shared notification/header/footer/empty views through named container slots, and feeds native threshold events into the existing frozen-top state machine. The plain/preview path still renders the shared list.
- `historyActivityRows.ts` uses named exports of the existing transfer/approval helpers. It emits generic activity amounts, badges, paired visuals and descriptions; fee and address metadata are joined in the native adapter. A malformed row is isolated as the old row error boundary did.
- Pending-only controllers reuse `useReplaceTx`; BTC speed-up still presents the existing RBF/F2Pool choices. Address badges reuse `TxHistoryAddressInfo`, including copy interaction and native action-anchor invalidation.
- Metadata requests use stable network/account and address identity keys. Component-local caches fetch only missing identities with the existing bounded-concurrency promise utility; address label update events replace the cache. Account/filter identity remounts isolate old requests.
- Focused mapper suite: 11 passing cases covering UTXO precedence/netting, multi-transfer overflow, hidden balances, paired AllNetworks badges, fallback, increase-allowance zero, private-send creation fees, and malformed-row isolation. Native module and full app gate results are tracked in the parent migration document.
- Live iOS/Android visual and gesture acceptance is still a separate required step. Source/type tests do not establish scrolling performance or pixel parity.
