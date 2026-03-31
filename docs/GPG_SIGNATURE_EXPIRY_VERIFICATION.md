# GPG Signature Expiry Verification Plan

## Goal

Validate how the current repository behaves when a signing key is expired at verification time, with special attention to the difference between:

- the current wall-clock time
- the OpenPGP signature creation time
- metadata fields inside the signed JSON payload

This document intentionally does **not** include any production armored public key content or any signed message block content. Use local fixtures when reproducing.

## Code Paths Under Test

- Node/Desktop:
  - `apps/desktop/app/bundle.ts`
  - `packages/kit-bg/src/desktopApis/DesktopApiAppUpdate.ts`
- iOS:
  - `node_modules/@onekeyfe/react-native-bundle-update/ios/ReactNativeBundleUpdate.swift`
- Android:
  - `node_modules/@onekeyfe/react-native-bundle-update/android/src/main/java/com/margelo/nitro/reactnativebundleupdate/ReactNativeBundleUpdate.kt`
  - `node_modules/@onekeyfe/react-native-app-update/android/src/main/java/com/margelo/nitro/reactnativeappupdate/ReactNativeAppUpdate.kt`

## Important Distinctions

- The JSON field `generatedAt` is **not** the same as the OpenPGP `signatureCreationTime`.
- Verification behavior is driven by the signature packet timestamp, not by the business metadata timestamp.
- A key being expired **now** does not automatically mean an existing signature will fail on every platform.

## Validation Matrix

| Scenario | Description | Node/Desktop | iOS | Android |
| --- | --- | --- | --- | --- |
| A | Key is expired now, but the signature was created before key expiry | Pass | Pass | Pass |
| B | Key is expired now, and the signature was created after key expiry | Fail | Fail | Pass |
| C | Same as A, but the signature timestamp was created with `gpg --faked-system-time` | Pass | Pass | Pass |

## Current Observations

- The repository's built-in update verification key expires at `2026-03-27 19:36:16 +0800`.
- The sampled release metadata signatures from build `2026032032` / bundle `7701116` had OpenPGP `signatureCreationTime` `2026-03-26 20:00:00 +0800`.
- Because that signature creation time is earlier than the key expiry time, those sampled metadata signatures verify successfully on Node/Desktop, iOS, and Android even though the key is already expired at runtime.
- When a new signature is genuinely created after the key expiry time, Node/Desktop and iOS reject it, while Android still accepts it because the current Android path only performs cryptographic signature verification and does not separately enforce key expiry.

## Reproduction Procedure

### 1. Inspect Key Expiry

Use either `gpg --show-keys --with-colons <public-key-file>` or the platform parser to read:

- key creation time
- key expiry time

Do not paste the armored public key into docs, issues, or PR descriptions.

### 2. Inspect Signature Creation Time

Use one of the following:

- `gpg --list-packets <signed-file>`
- OpenPGP.js: parse the cleartext message and inspect `signedMessage.signature.packets[0].created`

Do not use the JSON `generatedAt` field as a substitute for the OpenPGP signature time.

### 3. Verify With the Repository's Real Code Path

- Node/Desktop: reuse the same `readCleartextMessage(...)`, `readKey(...)`, and `verify(...)` flow used by the desktop update code.
- iOS: reuse the same `Gopenpgp` `verifyCleartext(...)` flow used by the iOS update module.
- Android: reuse the same BouncyCastle `PGPSignature.verify()` flow used by the Android update modules.

### 4. Backdated Signature Experiment

To validate the case "key expired now, but signature created before expiry":

1. Create a temporary test key that expires at a known wall-clock boundary.
2. Use `gpg --faked-system-time` to create a cleartext signature with a timestamp before expiry.
3. Advance real time beyond the key expiry.
4. Verify the sample on Node/Desktop, iOS, and Android.
5. Confirm that the OpenPGP `signatureCreationTime` is earlier than the key expiry.

### 5. Post-Expiry Signature Experiment

To validate the case "new signature created after expiry":

1. Reuse an expired key.
2. Create a signature whose OpenPGP creation time is later than the key expiry time.
3. Verify the sample on Node/Desktop, iOS, and Android.
4. Expected result: Node/Desktop and iOS fail, while Android passes.

## Expected Conclusions

- Current Node/Desktop and iOS behavior is effectively: allow historical signatures, reject post-expiry signatures.
- Current Android behavior does not enforce key expiry during verification.
- A backdated signature can still pass on all three ends if its OpenPGP signature creation time is earlier than the key expiry time.
- If the product requirement is "fail whenever the public key is expired right now", then explicit expiry checks must be added to every verification path, especially Android.
