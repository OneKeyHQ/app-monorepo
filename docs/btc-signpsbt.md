# BTC `signPsbt` Options

This note documents the current `signPsbt` option surface that already exists in the OneKey BTC provider types and implementation.

It is intended for developers who are integrating with the BTC dapp provider and want to control which inputs are signed or whether the returned PSBT is finalized automatically.

## Parameter Shape

The current provider types define the following shape:

```ts
type IToSignInput = {
  index: number;
  address?: string;
  publicKey?: string;
  sighashTypes?: number[];
  disableTweakSigner?: boolean;
  useTweakedSigner?: boolean;
};

type ISignPsbtOptions = {
  autoFinalized?: boolean;
  toSignInputs?: IToSignInput[];
  isBtcWalletProvider?: boolean;
};
```

## What The Options Do

### `autoFinalized`

- Default behavior: signed inputs are finalized before the PSBT hex is returned.
- If you pass `autoFinalized: false`, the provider skips `finalizeInput(...)` and returns a partially signed PSBT.

### `toSignInputs`

If `toSignInputs` is provided, the provider uses that list instead of auto-discovering signable inputs from the PSBT.

Each entry can include:

- `index`: required input index in the PSBT
- `address`: optional override for the signer address
- `publicKey`: optional override for the signer public key
- `sighashTypes`: optional array of sighash flags to pass through to signing
- `disableTweakSigner`: optional advanced flag forwarded to the signing flow
- `useTweakedSigner`: optional advanced flag forwarded to the signing flow

If `address` or `publicKey` is omitted, the provider falls back to the current account values.

### `isBtcWalletProvider`

This flag is also part of the current option shape. In the present implementation it affects how fallback input discovery behaves when `toSignInputs` is not provided.

Most integrations that already know which PSBT inputs they want signed should prefer `toSignInputs` directly and leave this flag alone.

## Example

The following pattern is supported by the current provider implementation:

```ts
const signedPsbt = await window.$onekey.btc.signPsbt(psbtHex, {
  autoFinalized: false,
  toSignInputs: [
    {
      index: 0,
      publicKey,
      sighashTypes: [SIGHASH_ALL],
    },
  ],
});
```

## Related Method

`signPsbts` reuses the same `ISignPsbtOptions` shape when signing multiple PSBTs in one call.

## Scope Of This Note

This document only describes the currently exposed option shape and how the present implementation handles it. It does not change account-type support, signing policy, or hardware wallet behavior.

## Source References

- [`packages/shared/types/ProviderApis/ProviderApiBtc.type.ts`](../packages/shared/types/ProviderApis/ProviderApiBtc.type.ts)
- [`packages/kit-bg/src/providers/ProviderApiBtc.ts`](../packages/kit-bg/src/providers/ProviderApiBtc.ts)
- [`packages/core/src/chains/btc/sdkBtc/index.ts`](../packages/core/src/chains/btc/sdkBtc/index.ts)
