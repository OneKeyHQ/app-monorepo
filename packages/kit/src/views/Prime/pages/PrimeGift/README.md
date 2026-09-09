# Pro 2 Prime gift

Implements [OK-62311](https://onekeyhq.atlassian.net/browse/OK-62311) using the serial-number lookup and verification-v2/code-redemption flow agreed for the mock integration.

## Runtime flow

1. `PrimeGiftOffer` queries `apiGetPrimeGiftEligibility({ serialNo })` from the Onboarding V2 completion screen or device details. Both entries open `EPrimePages.PrimeGift`.
2. The user signs into OneKey ID, reviews the receiving account, and explicitly confirms the claim. Account eligibility is checked before hardware interaction. Active paid subscriptions, including cancelled-but-unexpired subscriptions, are blocked. Missing account metadata fails closed.
3. The background service verifies the real device certificate and checks the serial returned by `/wallet/v1/hardware/verify`. The mocked v2 response adds the configured `primeRedeemCode`. An advertised serial number or previous Onboarding boolean never authorizes redemption.
4. The existing Prime redemption implementation exchanges the code. Only a validated server redemption response creates the success receipt. Profile refresh is best effort and cannot reverse confirmed success.
5. The receipt is bound to the device and original OneKey ID. Both offer entries disappear after success. The success page can explicitly open KYT; notification permission is optional. Enter wallet dismisses overlays and selects the wallet tab.

Hardware verification, secure code storage, serialization of claims, and redemption run in `bg`. Native `main` receives eligibility and receipt data, never the redemption code. Desktop and web use the existing single-runtime service boundary.

## Configure the mock

In a development build, open the Prime debug panel and choose **Configure Pro 2 Prime gift**. Enter the physical device serial, configured gift months, and a valid test redemption code, then confirm through the existing developer password dialog. Reopen device details to refresh eligibility.

- The mock is disabled until explicitly configured and is unavailable in production.
- No fake code or local membership activation is supplied. A valid test code and connected Pro 2 are needed for a real redemption.
- Code storage uses the existing platform secure storage. Native builds support this path; ordinary web and ordinary desktop development builds do not expose secure storage, so they can use the Gallery visual preview but cannot configure a real code through this mock.
- Before issuance, a configured code can be replaced. Once issued, retries preserve that code. The code is deleted after a confirmed receipt is stored. SimpleDB stores only its secure-storage reference.
- `apiGetPrimeGiftClaimResult` returns locally confirmed receipts for the signed-in account. It is not a remote server receipt endpoint.

## Recovery and server integration

A code-ready claim can retry after device verification or redemption failure. `apiGetPrimeGiftClaimProgress` exposes only the current account's verification status, so the page can skip completed steps without receiving the code. Account eligibility query failures can be retried on the same page. In-flight or unknown claims stay bound to their original account. A successful server response is saved for that account before the final auth-session check, even if the UI has switched accounts. The background service broadcasts the confirmed device status even when the claim page has unmounted.

If a response is lost after the server redeems the code, the current API cannot determine the outcome. The mock retains `resultUnknown` and retries the same code; it does not infer success from the user's Prime profile. The real v2 integration needs a receipt lookup or idempotent redemption response to fully resolve this case. Local mock state does not enforce cross-install or cross-device lifetime limits; the server must enforce those limits atomically.

The real eligibility/v2 endpoints should replace the mock data boundary while preserving account guards, certificate serial validation, code handling, and receipt recovery. The success page displays actual `addedDays / 30` and `finalExpiresAt` from redemption, rather than the configured preview duration.

## UI preview

Run `WEB_PORT=3037 yarn app:web --host 127.0.0.1` and visit `/dev/component-Pro2PrimeGift`. The preview reuses the product claim/success components, supports signed-out, ready, verified, error, and success states, and uses the Gallery theme switch. Its KYT and notification interactions are explicitly local previews.

New gift-specific copy uses English `ETranslationsMock` entries pending localization. Existing Prime benefits and generic actions reuse bundled translations. No generated locale files are edited.
