# CLI BTC/TBTC Transfer And Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BTC/TBTC derived-wallet reads, native transfer, and swap/bridge execution to `apps/cli`, with matching `onekey-tools` cli-e2e coverage.

**Architecture:** Match the current EVM CLI shape: command modules orchestrate API calls and transaction building, while chain-specific signers under `apps/cli/src/signer/impls/<impl>` adapt core/hardware signing. BTC/TBTC reuse core BTC types and hardware SDK methods, but the CLI does not import or instantiate App `kit-bg` Vault runtime.

**Tech Stack:** TypeScript, Commander, Zod, Jest, `@onekeyhq/core` BTC SDK, `@onekeyfe/hd-core`, OneKey wallet/swap APIs, `onekey-tools` `@onekey/cli-e2e` with `tsx`.

---

## File Map

### `apps/cli`

- Create `apps/cli/src/core/btc/address-types.ts`: canonical CLI address-type map, BTC/TBTC path templates, address encoding helpers.
- Create `apps/cli/src/core/btc/account.ts`: derive BTC/TBTC addresses and query account/balance/history helpers for one or all address types.
- Create `apps/cli/src/core/btc/tx-builder.ts`: build `IEncodedTxBtc`, collect UTXOs, prepare `btcExtraInfo`, and produce dry-run summaries.
- Create `apps/cli/src/commands/wallet/index.ts`: wallet command group.
- Create `apps/cli/src/commands/wallet/wallet-address-types.ts`: `onekey wallet address-types`.
- Create `apps/cli/src/commands/wallet/wallet-address.ts`: `onekey wallet address`.
- Create `apps/cli/src/schemas/wallet-schemas.ts`: wallet command schemas.
- Create `apps/cli/src/signer/impls/btc/index.ts`: BTC/TBTC signer builders.
- Create `apps/cli/src/signer/impls/btc/btc-path.ts`: signer-facing path helpers that wrap `core/btc/address-types.ts`.
- Create `apps/cli/src/signer/impls/btc/SignerHd.ts`: software BTC/TBTC signer.
- Create `apps/cli/src/signer/impls/btc/SignerHardware.ts`: OneKey hardware BTC/TBTC signer.
- Modify `apps/cli/src/core/chain-resolver.ts`: add BTC transfer capability and keep swap capability gated by command/backend checks.
- Modify `apps/cli/src/core/token-resolver.ts`: resolve BTC/TBTC native tokens without EVM market search.
- Modify `apps/cli/src/core/pending-storage.ts`: persist BTC address metadata in swap orders.
- Modify `apps/cli/src/signer/types.ts`: extend sign payload with BTC fields without breaking EVM callers.
- Modify `apps/cli/src/signer/registry.ts`: register BTC/TBTC signer builders.
- Modify `apps/cli/src/commands/index.ts` and `apps/cli/src/cli.ts`: register wallet command group.
- Modify `apps/cli/src/commands/balance.ts`: support derived BTC/TBTC aggregate and per-address-type reads.
- Modify `apps/cli/src/commands/wallet-history.ts`: support derived BTC/TBTC history.
- Modify `apps/cli/src/commands/transfer.ts`: add BTC/TBTC transfer branch.
- Modify `apps/cli/src/commands/swap/swap-networks.ts`: include backend-supported non-EVM networks.
- Modify `apps/cli/src/commands/swap/swap-quote.ts`: add BTC/TBTC address-type requirements and address derivation.
- Modify `apps/cli/src/commands/swap/swap-build.ts`: persist BTC address metadata and accept `btcData`.
- Modify `apps/cli/src/commands/swap/swap-execute.ts`: add BTC PSBT execution path.
- Modify schemas under `apps/cli/src/schemas/`: add address-type inputs and BTC output shapes.
- Add or update Jest tests under `apps/cli/src/__tests__/`.

### `onekey-tools`

- Modify `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/config.ts`: BTC/TBTC address-type and funded-spend fixture config.
- Modify `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/index.ts`: include BTC testnet spend section in safe/testnet profiles when guarded.
- Modify `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/schemas.ts`: accept BTC aggregate balance, BTC txid, BTC swap metadata.
- Modify `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/sections/read-only.ts`: replace unsupported-transfer BTC negative and add wallet address checks.
- Create `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/sections/testnet-spend/btc-transfer.ts`: TBTC dry-run and guarded broadcast.
- Modify `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/docs/runbooks/mac-mini-setup.md`: document BTC/TBTC requirements.
- Update cli-e2e tests under `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/**/*.test.ts`.

---

### Task 1: BTC Address Types And Capabilities

**Files:**
- Create: `apps/cli/src/core/btc/address-types.ts`
- Modify: `apps/cli/src/core/chain-resolver.ts`
- Modify: `apps/cli/src/schemas/common.ts`
- Test: `apps/cli/src/__tests__/btc-address-types.test.ts`
- Test: `apps/cli/src/__tests__/chain-resolver.test.ts`

- [ ] **Step 1: Write failing address-type tests**

Add `apps/cli/src/__tests__/btc-address-types.test.ts`:

```ts
import { EAddressEncodings } from '@onekeyhq/core/src/types';

import {
  BTC_ADDRESS_TYPES,
  assertBtcAddressType,
  getBtcAddressTypeInfo,
  listBtcAddressTypeInfos,
} from '../core/btc/address-types';

describe('BTC CLI address types', () => {
  it('maps user-facing address types to derive metadata', () => {
    expect(BTC_ADDRESS_TYPES).toEqual([
      'taproot',
      'native-segwit',
      'nested-segwit',
      'legacy',
    ]);
    expect(getBtcAddressTypeInfo('btc', 'taproot')).toMatchObject({
      addressType: 'taproot',
      deriveType: 'BIP86',
      addressEncoding: EAddressEncodings.P2TR,
      path: "m/86'/0'/0'/0/0",
      relPath: '0/0',
    });
    expect(getBtcAddressTypeInfo('tbtc', 'nested-segwit')).toMatchObject({
      addressType: 'nested-segwit',
      deriveType: 'default',
      addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      path: "m/49'/1'/0'/0/0",
      relPath: '0/0',
    });
  });

  it('rejects unknown address types with supported values', () => {
    expect(() => assertBtcAddressType('segwit')).toThrow(
      'Invalid BTC address type',
    );
  });

  it('lists all address type infos for a network impl', () => {
    const infos = listBtcAddressTypeInfos('tbtc');
    expect(infos).toHaveLength(4);
    expect(infos.map((i) => i.path)).toEqual([
      "m/86'/1'/0'/0/0",
      "m/84'/1'/0'/0/0",
      "m/49'/1'/0'/0/0",
      "m/44'/1'/0'/0/0",
    ]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-address-types.test.ts
```

Expected: FAIL because `../core/btc/address-types` does not exist.

- [ ] **Step 3: Implement address-type helpers**

Create `apps/cli/src/core/btc/address-types.ts`:

```ts
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINTYPE_BTC,
  COINTYPE_TBTC,
  IMPL_BTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../../errors';

export const BTC_ADDRESS_TYPES = [
  'taproot',
  'native-segwit',
  'nested-segwit',
  'legacy',
] as const;

export type BtcAddressType = (typeof BTC_ADDRESS_TYPES)[number];

export interface IBtcAddressTypeInfo {
  addressType: BtcAddressType;
  label: string;
  deriveType: 'BIP86' | 'BIP84' | 'default' | 'BIP44';
  addressEncoding: EAddressEncodings;
  purpose: 86 | 84 | 49 | 44;
  coinType: number;
  path: string;
  accountPath: string;
  relPath: '0/0';
}

const ADDRESS_TYPE_BASE: Record<
  BtcAddressType,
  Omit<IBtcAddressTypeInfo, 'coinType' | 'path' | 'accountPath'>
> = {
  taproot: {
    addressType: 'taproot',
    label: 'Taproot',
    deriveType: 'BIP86',
    addressEncoding: EAddressEncodings.P2TR,
    purpose: 86,
    relPath: '0/0',
  },
  'native-segwit': {
    addressType: 'native-segwit',
    label: 'Native SegWit',
    deriveType: 'BIP84',
    addressEncoding: EAddressEncodings.P2WPKH,
    purpose: 84,
    relPath: '0/0',
  },
  'nested-segwit': {
    addressType: 'nested-segwit',
    label: 'Nested SegWit',
    deriveType: 'default',
    addressEncoding: EAddressEncodings.P2SH_P2WPKH,
    purpose: 49,
    relPath: '0/0',
  },
  legacy: {
    addressType: 'legacy',
    label: 'Legacy',
    deriveType: 'BIP44',
    addressEncoding: EAddressEncodings.P2PKH,
    purpose: 44,
    relPath: '0/0',
  },
};

export function isBtcImpl(impl: string): impl is typeof IMPL_BTC | typeof IMPL_TBTC {
  return impl === IMPL_BTC || impl === IMPL_TBTC;
}

export function assertBtcImpl(impl: string): asserts impl is typeof IMPL_BTC | typeof IMPL_TBTC {
  if (!isBtcImpl(impl)) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported BTC impl: ${impl}`,
      'Use chain btc or tbtc.',
    );
  }
}

export function isBtcAddressType(value: string): value is BtcAddressType {
  return (BTC_ADDRESS_TYPES as readonly string[]).includes(value);
}

export function assertBtcAddressType(value: string): BtcAddressType {
  if (isBtcAddressType(value)) return value;
  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CONFIG.code,
    `Invalid BTC address type: "${value}"`,
    `Supported address types: ${BTC_ADDRESS_TYPES.join(', ')}`,
  );
}

export function getBtcCoinType(impl: string): number {
  assertBtcImpl(impl);
  return impl === IMPL_TBTC ? COINTYPE_TBTC : COINTYPE_BTC;
}

export function getBtcAddressTypeInfo(
  impl: string,
  addressTypeInput: string,
): IBtcAddressTypeInfo {
  const addressType = assertBtcAddressType(addressTypeInput);
  const base = ADDRESS_TYPE_BASE[addressType];
  const coinType = getBtcCoinType(impl);
  const accountPath = `m/${base.purpose}'/${coinType}'/0'`;
  return {
    ...base,
    coinType,
    accountPath,
    path: `${accountPath}/0/0`,
  };
}

export function listBtcAddressTypeInfos(impl: string): IBtcAddressTypeInfo[] {
  return BTC_ADDRESS_TYPES.map((type) => getBtcAddressTypeInfo(impl, type));
}
```

- [ ] **Step 4: Add chain capability and schema constants**

Modify `apps/cli/src/core/chain-resolver.ts` so `CliChainCapability` includes `btcTransfer`, and BTC/TBTC capabilities include it:

```ts
export type CliChainCapability =
  | 'accountRead'
  | 'historyRead'
  | 'evmTransfer'
  | 'btcTransfer'
  | 'evmTokenMarket'
  | 'evmSecurity'
  | 'swap';

const BTC_CAPABILITIES = new Set<CliChainCapability>([
  'accountRead',
  'historyRead',
  'btcTransfer',
  'swap',
]);
```

Keep EVM capabilities unchanged. Replace `BTC_READ_ONLY_CAPABILITIES` references with `BTC_CAPABILITIES`.

Modify `apps/cli/src/schemas/common.ts` to export an address-type schema:

```ts
import { z } from 'zod';

export const btcAddressType = z.enum([
  'taproot',
  'native-segwit',
  'nested-segwit',
  'legacy',
]);
```

Preserve all existing exports in `common.ts`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/btc-address-types.test.ts \
  apps/cli/src/__tests__/chain-resolver.test.ts
```

Expected: PASS after updating existing capability assertions to expect BTC/TBTC `btcTransfer` and `swap`.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/core/btc/address-types.ts apps/cli/src/core/chain-resolver.ts apps/cli/src/schemas/common.ts apps/cli/src/__tests__/btc-address-types.test.ts apps/cli/src/__tests__/chain-resolver.test.ts
git commit -m "feat(cli): add btc address type model"
```

### Task 2: BTC/TBTC Signer Registration And HD Derivation

**Files:**
- Modify: `apps/cli/src/signer/types.ts`
- Modify: `apps/cli/src/signer/registry.ts`
- Create: `apps/cli/src/signer/impls/btc/index.ts`
- Create: `apps/cli/src/signer/impls/btc/btc-path.ts`
- Create: `apps/cli/src/signer/impls/btc/SignerHd.ts`
- Test: `apps/cli/src/__tests__/btc-signer-hd.test.ts`
- Test: `apps/cli/src/__tests__/signer-factory.test.ts`

- [ ] **Step 1: Write failing HD signer tests**

Add `apps/cli/src/__tests__/btc-signer-hd.test.ts` with mocked core BTC import:

```ts
import { EAddressEncodings } from '@onekeyhq/core/src/types';

jest.mock('../signer/base/SignerSoftwareBase', () => {
  class SignerSoftwareBase {
    async baseGetHdCredential() {
      return 'encrypted-hd-credential';
    }
    async baseGetEncodedPassword() {
      return 'encoded-password';
    }
  }
  return { SignerSoftwareBase };
});

const getAddressesFromHd = jest.fn(async () => ({
  addresses: [
    {
      address: 'tb1pderived',
      path: "m/86'/1'/0'",
      relPath: '0/0',
      publicKey: '02abcd',
      xpub: 'tpub',
      xpubSegwit: 'tpub-segwit',
      addresses: { '0/0': 'tb1pderived' },
    },
  ],
}));
const signTransaction = jest.fn(async () => ({
  rawTx: '00',
  txid: 'a'.repeat(64),
  encodedTx: null,
}));

jest.mock('@onekeyhq/core/src/chains/btc', () => ({
  __esModule: true,
  default: class BtcScope {
    hd = { getAddressesFromHd, signTransaction };
  },
}));

describe('BTC SignerHd', () => {
  beforeEach(() => {
    getAddressesFromHd.mockClear();
    signTransaction.mockClear();
  });

  it('derives tbtc taproot address from address type', async () => {
    const { SignerHd } = await import('../signer/impls/btc/SignerHd');
    const signer = new SignerHd({ impl: 'tbtc' });
    const address = await signer.getAddress('tbtc--0', {
      addressType: 'taproot',
    });

    expect(address.address).toBe('tb1pderived');
    expect(getAddressesFromHd).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "m/86'/1'/0'/0/0",
        indexes: [0],
        addressEncoding: EAddressEncodings.P2TR,
      }),
    );
  });

  it('passes btcExtraInfo and relPaths into core signing', async () => {
    const { SignerHd } = await import('../signer/impls/btc/SignerHd');
    const signer = new SignerHd({ impl: 'tbtc' });
    await signer.signTransaction({
      networkId: 'tbtc--0',
      account: { address: 'tb1pderived', path: "m/86'/1'/0'" },
      unsignedTx: { encodedTx: { inputs: [], outputs: [] } },
      relPaths: ['0/0'],
      btcExtraInfo: {
        pathToAddresses: {},
        addressToPath: {},
      },
    });

    expect(signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        networkInfo: expect.objectContaining({
          networkChainCode: 'tbtc',
          networkImpl: 'tbtc',
          networkId: 'tbtc--0',
        }),
        relPaths: ['0/0'],
        btcExtraInfo: expect.objectContaining({
          pathToAddresses: {},
          addressToPath: {},
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-signer-hd.test.ts
```

Expected: FAIL because BTC signer files and extended `getAddress` signature do not exist.

- [ ] **Step 3: Extend signer interfaces**

Modify `apps/cli/src/signer/types.ts`:

```ts
import type { ICoreApiSignBtcExtraInfo } from '@onekeyhq/core/src/types';
import type { BtcAddressType } from '../core/btc/address-types';

export interface ISignerGetAddressOptions {
  addressType?: BtcAddressType;
}

export interface ISignTransactionPayload {
  networkId: string;
  account: { address: string; path: string; pub?: string };
  unsignedTx: { encodedTx: Record<string, unknown> };
  relPaths?: string[];
  btcExtraInfo?: ICoreApiSignBtcExtraInfo;
  signOnly?: boolean;
  addressType?: BtcAddressType;
}

export interface ISigner {
  getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem>;

  signTransaction(payload: ISignTransactionPayload): Promise<ISignedTxPro>;

  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}
```

Update EVM `SignerHd` and `SignerHardware` method signatures to accept the optional second argument and ignore it.

- [ ] **Step 4: Implement BTC path and HD signer**

Create `apps/cli/src/signer/impls/btc/btc-path.ts`:

```ts
import {
  getBtcAddressTypeInfo,
  isBtcImpl,
} from '../../../core/btc/address-types';
import { AppError, ERROR_CODES } from '../../../errors';

import type { BtcAddressType } from '../../../core/btc/address-types';

export function validateBtcNetworkId(impl: string, networkId: string): void {
  if (!isBtcImpl(impl) || networkId !== `${impl}--0`) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported BTC networkId: ${networkId}`,
      `Expected ${impl}--0.`,
    );
  }
}

export function resolveBtcAddressPath(impl: string, addressType: BtcAddressType) {
  return getBtcAddressTypeInfo(impl, addressType);
}
```

Create `apps/cli/src/signer/impls/btc/SignerHd.ts`:

```ts
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { SignerSoftwareBase } from '../../base/SignerSoftwareBase';
import { CLI_PASSWORD } from '../../keychain-keys';

import { resolveBtcAddressPath, validateBtcNetworkId } from './btc-path';

import type { ISignTransactionPayload, ISignerGetAddressOptions } from '../../types';

let btcScopePromise: Promise<
  InstanceType<typeof import('@onekeyhq/core/src/chains/btc').default>
> | null = null;

async function getBtcScope() {
  if (!btcScopePromise) {
    btcScopePromise = import('@onekeyhq/core/src/chains/btc').then((mod) => {
      const Scope = mod.default;
      return new Scope();
    });
  }
  return btcScopePromise;
}

export class SignerHd extends SignerSoftwareBase {
  constructor(private readonly config: { impl: 'btc' | 'tbtc' }) {
    super();
  }

  async getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateBtcNetworkId(this.config.impl, networkId);
    const addressType = options?.addressType;
    if (!addressType) {
      throw new Error('BTC getAddress requires addressType');
    }
    const info = resolveBtcAddressPath(this.config.impl, addressType);
    const hdCredential = await this.baseGetHdCredential();
    const scope = await getBtcScope();
    const result = await scope.hd.getAddressesFromHd({
      networkInfo: this.buildNetworkInfo(networkId),
      template: info.path,
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: info.addressEncoding,
    });
    return result.addresses[0];
  }

  async signTransaction(payload: ISignTransactionPayload): Promise<ISignedTxPro> {
    validateBtcNetworkId(this.config.impl, payload.networkId);
    const scope = await getBtcScope();
    const hdCredential = await this.baseGetHdCredential();
    const encodedPassword = await this.baseGetEncodedPassword();
    return scope.hd.signTransaction({
      networkInfo: this.buildNetworkInfo(payload.networkId),
      password: encodedPassword,
      credentials: { hd: hdCredential },
      account: payload.account,
      unsignedTx: payload.unsignedTx,
      relPaths: payload.relPaths,
      btcExtraInfo: payload.btcExtraInfo,
      signOnly: payload.signOnly,
    });
  }

  async signMessage(_payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('BTC message signing is not exposed by the CLI.');
  }

  buildNetworkInfo(networkId: string) {
    return {
      networkChainCode: this.config.impl,
      chainId: '0',
      networkImpl: this.config.impl,
      networkId,
    };
  }
}
```

Create `apps/cli/src/signer/impls/btc/index.ts`:

```ts
import type { ISignerBuilders } from '../../registry';

export const btcSignerBuilders: ISignerBuilders = {
  hd: async () => {
    const { SignerHd } = await import('./SignerHd');
    return new SignerHd({ impl: 'btc' });
  },
  hw: async (device, passphraseMode) => {
    const { SignerHardware } = await import('./SignerHardware');
    return new SignerHardware({ impl: 'btc', device, passphraseMode });
  },
};

export const tbtcSignerBuilders: ISignerBuilders = {
  hd: async () => {
    const { SignerHd } = await import('./SignerHd');
    return new SignerHd({ impl: 'tbtc' });
  },
  hw: async (device, passphraseMode) => {
    const { SignerHardware } = await import('./SignerHardware');
    return new SignerHardware({ impl: 'tbtc', device, passphraseMode });
  },
};
```

Temporarily create `SignerHardware.ts` with methods throwing `AppError` for hardware BTC signing; Task 3 replaces it with SDK calls.

- [ ] **Step 5: Register BTC/TBTC builders**

Modify `apps/cli/src/signer/registry.ts`:

```ts
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

const builderLoaders: Record<string, ISignerBuildersLoader> = {
  [IMPL_EVM]: () => import('./impls/evm').then((m) => m.evmSignerBuilders),
  [IMPL_BTC]: () => import('./impls/btc').then((m) => m.btcSignerBuilders),
  [IMPL_TBTC]: () => import('./impls/btc').then((m) => m.tbtcSignerBuilders),
};
```

Update `apps/cli/src/__tests__/signer-factory.test.ts` to assert `getSignerByImpl('btc')` and `getSignerByImpl('tbtc')` return an object whose constructor name is `SignerHd`.

- [ ] **Step 6: Run signer tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/btc-signer-hd.test.ts \
  apps/cli/src/__tests__/signer-factory.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/signer apps/cli/src/__tests__/btc-signer-hd.test.ts apps/cli/src/__tests__/signer-factory.test.ts
git commit -m "feat(cli): add btc hd signer"
```

### Task 3: OneKey Hardware BTC Signer

**Files:**
- Modify: `apps/cli/src/signer/impls/btc/SignerHardware.ts`
- Test: `apps/cli/src/__tests__/btc-signer-hardware.test.ts`
- Reference: `packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.ts`

- [ ] **Step 1: Write failing hardware signer tests**

Add `apps/cli/src/__tests__/btc-signer-hardware.test.ts`:

```ts
import { EAddressEncodings } from '@onekeyhq/core/src/types';

import { SignerHardware } from '../signer/impls/btc/SignerHardware';

const DEVICE = {
  connectId: 'connect-1',
  deviceId: 'device-1',
  deviceLabel: 'OneKey Test',
};

function makeDeps() {
  const sdk = {
    btcGetAddress: jest.fn(async () => ({
      success: true,
      payload: { address: 'tb1pderived', path: "m/86'/1'/0'/0/0" },
    })),
    btcSignTransaction: jest.fn(async () => ({
      success: true,
      payload: {
        rawTx: '00',
        txid: 'b'.repeat(64),
      },
    })),
    btcSignPsbt: jest.fn(async () => ({
      success: true,
      payload: {
        psbtHex: '70736274ff',
        txid: 'c'.repeat(64),
      },
    })),
  };
  return {
    sdk,
    deps: {
      ensureSDKReady: jest.fn(async () => sdk),
      installPassphraseProvider: jest.fn(),
      resolvePassphraseStateByMode: jest.fn(async () => undefined),
      keychainFactory: () => ({
        get: jest.fn(async () => null),
        set: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
      }),
      preloadSessionCache: jest.fn(),
      stderr: { write: jest.fn(() => true) },
    },
  };
}

describe('BTC SignerHardware', () => {
  it('derives an address with btcGetAddress', async () => {
    const { sdk, deps } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device: DEVICE,
      passphraseMode: 'none',
      deps,
    });

    const addr = await signer.getAddress('tbtc--0', {
      addressType: 'taproot',
    });

    expect(addr.address).toBe('tb1pderived');
    expect(sdk.btcGetAddress).toHaveBeenCalledWith(
      DEVICE.connectId,
      DEVICE.deviceId,
      expect.objectContaining({
        path: "m/86'/1'/0'/0/0",
        coin: 'Testnet',
        showOnOneKey: false,
      }),
    );
  });

  it('signs normal btc transactions with btcSignTransaction', async () => {
    const { sdk, deps } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device: DEVICE,
      passphraseMode: 'none',
      deps,
    });

    const signed = await signer.signTransaction({
      networkId: 'tbtc--0',
      account: { address: 'tb1pderived', path: "m/86'/1'/0'/0/0" },
      addressType: 'taproot',
      relPaths: ['0/0'],
      unsignedTx: {
        encodedTx: {
          inputs: [],
          outputs: [],
          fee: '100',
          txSize: 120,
        },
      },
      btcExtraInfo: {
        pathToAddresses: {},
        addressToPath: {},
        inputAddressesEncodings: [EAddressEncodings.P2TR],
      },
    });

    expect(signed.txid).toBe('b'.repeat(64));
    expect(sdk.btcSignTransaction).toHaveBeenCalledTimes(1);
  });

  it('signs psbt transactions with btcSignPsbt', async () => {
    const { sdk, deps } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device: DEVICE,
      passphraseMode: 'none',
      deps,
    });

    await signer.signTransaction({
      networkId: 'tbtc--0',
      account: { address: 'tb1pderived', path: "m/86'/1'/0'/0/0" },
      addressType: 'taproot',
      relPaths: ['0/0'],
      unsignedTx: {
        encodedTx: {
          psbtHex: '70736274ff',
          inputsToSign: [{ index: 0, address: 'tb1pderived' }],
        },
      },
      btcExtraInfo: {
        pathToAddresses: {},
        addressToPath: {},
      },
    });

    expect(sdk.btcSignPsbt).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-signer-hardware.test.ts
```

Expected: FAIL because `SignerHardware` still throws or lacks BTC SDK adaptation.

- [ ] **Step 3: Implement BTC hardware adapter**

Modify `apps/cli/src/signer/impls/btc/SignerHardware.ts`. Use the exact SDK payload shapes from `packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.ts`:

```ts
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { unwrapSDKResult } from '../../../commands/device/hardware-sdk';
import { AppError, ERROR_CODES } from '../../../errors';
import { SignerHardwareBase } from '../../base/SignerHardwareBase';

import { resolveBtcAddressPath, validateBtcNetworkId } from './btc-path';

import type { ISignTransactionPayload, ISignerGetAddressOptions } from '../../types';
import type { DeviceInfo, PassphraseMode } from '../../../core/auth/auth-types';

interface IBtcHardwareConfig {
  impl: 'btc' | 'tbtc';
  device: DeviceInfo;
  passphraseMode: PassphraseMode;
  deps?: ConstructorParameters<typeof SignerHardwareBase>[0]['deps'];
}

function coinNameForImpl(impl: 'btc' | 'tbtc'): 'Bitcoin' | 'Testnet' {
  return impl === 'btc' ? 'Bitcoin' : 'Testnet';
}

export class SignerHardware extends SignerHardwareBase {
  private readonly impl: 'btc' | 'tbtc';

  constructor(config: IBtcHardwareConfig) {
    super(config);
    this.impl = config.impl;
  }

  async getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateBtcNetworkId(this.impl, networkId);
    if (!options?.addressType) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'BTC getAddress requires addressType.',
        'Pass --address-type taproot|native-segwit|nested-segwit|legacy.',
      );
    }
    const info = resolveBtcAddressPath(this.impl, options.addressType);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();
    const result = await sdk.btcGetAddress(
      this.device.connectId,
      this.device.deviceId,
      {
        path: info.path,
        coin: coinNameForImpl(this.impl),
        showOnOneKey: false,
        ...commonParams,
      },
    );
    const payload = unwrapSDKResult<{ address: string; path: string }>(
      result,
      'getAddress',
    );
    return {
      address: payload.address,
      path: payload.path || info.accountPath,
      relPath: info.relPath,
      addresses: { [info.relPath]: payload.address },
      __hwExtraInfo__: undefined,
    } as ICoreApiGetAddressItem;
  }

  async signTransaction(payload: ISignTransactionPayload): Promise<ISignedTxPro> {
    validateBtcNetworkId(this.impl, payload.networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();
    const encodedTx = payload.unsignedTx.encodedTx as Record<string, unknown>;
    if (typeof encodedTx.psbtHex === 'string') {
      const response = await sdk.btcSignPsbt(
        this.device.connectId,
        this.device.deviceId,
        {
          psbt: encodedTx.psbtHex,
          coin: coinNameForImpl(this.impl),
          ...commonParams,
        },
      );
      const signed = unwrapSDKResult<{ psbtHex?: string; txid?: string }>(
        response,
        'signPsbt',
      );
      return {
        rawTx: signed.psbtHex ?? '',
        txid: signed.txid ?? '',
        encodedTx,
      } as unknown as ISignedTxPro;
    }

    const response = await sdk.btcSignTransaction(
      this.device.connectId,
      this.device.deviceId,
      {
        coin: coinNameForImpl(this.impl),
        inputs: encodedTx.inputs,
        outputs: encodedTx.outputs,
        refTxs: payload.btcExtraInfo?.nonWitnessPrevTxs,
        ...commonParams,
      },
    );
    const signed = unwrapSDKResult<{ rawTx: string; txid: string }>(
      response,
      'signTransaction',
    );
    return {
      rawTx: signed.rawTx,
      txid: signed.txid,
      encodedTx,
    } as unknown as ISignedTxPro;
  }

  async signMessage(_payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'BTC message signing is not exposed by the CLI.',
      'Use transfer or swap commands for BTC transaction signing.',
    );
  }
}
```

If TypeScript reports exact BTC SDK parameter names differ, inspect `node_modules/@onekeyfe/hd-core/src/types/api/btcSignTransaction*` and update the payload names in this file and tests together.

- [ ] **Step 4: Run hardware signer tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-signer-hardware.test.ts apps/cli/src/__tests__/evm-signer-hardware.test.ts
```

Expected: PASS. EVM hardware tests must remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/signer/impls/btc/SignerHardware.ts apps/cli/src/__tests__/btc-signer-hardware.test.ts
git commit -m "feat(cli): add btc hardware signer"
```

### Task 4: Wallet Address Commands

**Files:**
- Create: `apps/cli/src/commands/wallet/index.ts`
- Create: `apps/cli/src/commands/wallet/wallet-address-types.ts`
- Create: `apps/cli/src/commands/wallet/wallet-address.ts`
- Create: `apps/cli/src/schemas/wallet-schemas.ts`
- Modify: `apps/cli/src/commands/index.ts`
- Modify: `apps/cli/src/cli.ts`
- Modify: `apps/cli/src/schemas/register-all.ts`
- Test: `apps/cli/src/__tests__/wallet-btc-address.test.ts`

- [ ] **Step 1: Write failing command tests**

Add `apps/cli/src/__tests__/wallet-btc-address.test.ts` using the existing CLI command test style from `cli.integration.test.ts`:

```ts
import { Command } from 'commander';

import { registerWalletCommands } from '../commands/wallet';

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(async () => ({
    getAddress: jest.fn(async () => ({
      address: 'tb1pderived',
      path: "m/86'/1'/0'",
      relPath: '0/0',
      publicKey: '02abcd',
    })),
  })),
}));

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  program.option('--json');
  program.hook('preAction', (_root, action) => {
    action.setOptionValue('_outputFormatter', {
      success: jest.fn(),
      error: jest.fn(),
      raw: jest.fn(),
      info: jest.fn(),
      getMode: () => 'agent',
    });
  });
  registerWalletCommands(program);
  return program;
}

describe('wallet btc address commands', () => {
  it('registers address-types under wallet', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'test', 'wallet', 'address-types', '--chain', 'btc']);
    const output = program.commands[0].commands[0].getOptionValue('_outputFormatter');
    expect(output.success).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ addressType: 'taproot' }),
      ]),
      expect.objectContaining({ chain: 'btc' }),
    );
  });

  it('derives one address for an explicit address type', async () => {
    const program = makeProgram();
    await program.parseAsync([
      'node',
      'test',
      'wallet',
      'address',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
    ]);
    const output = program.commands[0].commands[1].getOptionValue('_outputFormatter');
    expect(output.success).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'tbtc',
        addressType: 'taproot',
        address: 'tb1pderived',
      }),
      expect.objectContaining({ chain: 'tbtc' }),
    );
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/wallet-btc-address.test.ts
```

Expected: FAIL because wallet command files do not exist.

- [ ] **Step 3: Implement wallet commands**

Create `apps/cli/src/commands/wallet/index.ts`:

```ts
import { Command } from 'commander';

import { registerWalletAddressCommand } from './wallet-address';
import { registerWalletAddressTypesCommand } from './wallet-address-types';

export function registerWalletCommands(program: Command): void {
  const wallet = new Command('wallet').description('Wallet account utilities');
  registerWalletAddressTypesCommand(wallet);
  registerWalletAddressCommand(wallet);
  program.addCommand(wallet);
}
```

Create `wallet-address-types.ts` to resolve chain, require BTC impl, list `listBtcAddressTypeInfos(chainConfig.impl)`, and output objects with `addressType`, `label`, `deriveType`, `addressEncoding`, `path`.

Create `wallet-address.ts` to resolve chain, parse `--address-type`, call `getSignerByImpl(chainConfig.impl).getAddress(chainConfig.networkId, { addressType })`, and output `chain`, `networkId`, `addressType`, `deriveType`, `addressEncoding`, `path`, `address`, `publicKey`.

- [ ] **Step 4: Register commands and schemas**

Modify `apps/cli/src/commands/index.ts`:

```ts
export { registerWalletCommands } from './wallet';
```

Modify `apps/cli/src/cli.ts` to import and call `registerWalletCommands(program)` near `registerWalletHistoryCommand(program)`.

Create `apps/cli/src/schemas/wallet-schemas.ts` with Zod schemas for address and address-types output, then add `defineCommand` entries to `apps/cli/src/schemas/register-all.ts`.

- [ ] **Step 5: Run command tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/wallet-btc-address.test.ts apps/cli/src/__tests__/cli.integration.test.ts
```

Expected: PASS, and `onekey wallet --help` appears in CLI help if smoke tests cover help output.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/commands/wallet apps/cli/src/commands/index.ts apps/cli/src/cli.ts apps/cli/src/schemas/wallet-schemas.ts apps/cli/src/schemas/register-all.ts apps/cli/src/__tests__/wallet-btc-address.test.ts
git commit -m "feat(cli): add btc wallet address commands"
```

### Task 5: BTC/TBTC Derived Balance And History

**Files:**
- Create: `apps/cli/src/core/btc/account.ts`
- Modify: `apps/cli/src/commands/balance.ts`
- Modify: `apps/cli/src/commands/wallet-history.ts`
- Modify: `apps/cli/src/schemas/balance-schema.ts`
- Modify: `apps/cli/src/schemas/wallet-history-schema.ts`
- Test: `apps/cli/src/__tests__/balance-btc-derived.test.ts`
- Test: `apps/cli/src/__tests__/history-btc-derived.test.ts`

- [ ] **Step 1: Write failing balance tests**

Add `apps/cli/src/__tests__/balance-btc-derived.test.ts`:

```ts
import { runBalanceActionForTest } from './helpers/command-runner';

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(async () => ({
    getAddress: jest
      .fn()
      .mockResolvedValueOnce({ address: 'tb1ptaproot', path: "m/86'/1'/0'" })
      .mockResolvedValueOnce({ address: 'tb1qnative', path: "m/84'/1'/0'" })
      .mockResolvedValueOnce({ address: '2Nnested', path: "m/49'/1'/0'" })
      .mockResolvedValueOnce({ address: 'mlegacy', path: "m/44'/1'/0'" }),
  })),
}));

jest.mock('../infra', () => ({
  apiClient: {
    setEnv: jest.fn(),
    get: jest.fn(async (_scope, _path, params) => ({
      address: params.accountAddress,
      balance: '1000',
      balanceParsed: '0.00001',
    })),
  },
}));

describe('BTC derived balance', () => {
  it('aggregates all tbtc address types when no address is provided', async () => {
    const output = await runBalanceActionForTest({
      chain: 'tbtc',
    });
    expect(output.success).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'tbtc',
        aggregate: expect.objectContaining({ balance: '0.00004' }),
        items: expect.arrayContaining([
          expect.objectContaining({ addressType: 'taproot', address: 'tb1ptaproot' }),
          expect.objectContaining({ addressType: 'native-segwit', address: 'tb1qnative' }),
        ]),
      }),
      expect.objectContaining({ chain: 'tbtc' }),
    );
  });
});
```

If no reusable command-runner helper exists, create `apps/cli/src/__tests__/helpers/command-runner.ts` that registers a `Command`, stubs `_outputFormatter`, invokes the action, and returns output spies.

- [ ] **Step 2: Run failing balance test**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/balance-btc-derived.test.ts
```

Expected: FAIL because derived BTC balance still requires `--address`.

- [ ] **Step 3: Implement BTC account read helpers**

Create `apps/cli/src/core/btc/account.ts`:

```ts
import BigNumber from 'bignumber.js';

import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import { assertAddressForChain } from '../address-utils';
import type { IChainConfig } from '../chain-resolver';

import {
  getBtcAddressTypeInfo,
  listBtcAddressTypeInfos,
} from './address-types';

import type { BtcAddressType } from './address-types';

interface IAccountResponse {
  address?: string;
  balance?: string;
  balanceParsed?: string;
  [key: string]: unknown;
}

export interface IBtcDerivedAccountBalance {
  addressType: BtcAddressType;
  label: string;
  deriveType: string;
  addressEncoding: string;
  address: string;
  path?: string;
  balance: string;
  balanceRaw?: string;
}

export async function deriveBtcAddress(
  chainConfig: IChainConfig,
  addressType: BtcAddressType,
) {
  const signer = await getSignerByImpl(chainConfig.impl);
  const info = getBtcAddressTypeInfo(chainConfig.impl, addressType);
  const address = await signer.getAddress(chainConfig.networkId, { addressType });
  return { ...info, ...address, addressType };
}

async function fetchBtcNativeAccount(
  networkId: string,
  address: string,
): Promise<IAccountResponse> {
  return apiClient.get<IAccountResponse>('wallet', '/wallet/v1/account/get-account', {
    networkId,
    accountAddress: address,
    withNetWorth: true,
  });
}

export async function fetchBtcDerivedBalances(
  chainConfig: IChainConfig,
  addressType?: BtcAddressType,
) {
  const infos = addressType
    ? [getBtcAddressTypeInfo(chainConfig.impl, addressType)]
    : listBtcAddressTypeInfos(chainConfig.impl);
  const items: IBtcDerivedAccountBalance[] = [];
  for (const info of infos) {
    const derived = await deriveBtcAddress(chainConfig, info.addressType);
    const account = await fetchBtcNativeAccount(
      chainConfig.networkId,
      derived.address,
    );
    items.push({
      addressType: info.addressType,
      label: info.label,
      deriveType: info.deriveType,
      addressEncoding: info.addressEncoding,
      address: derived.address,
      path: derived.path,
      balance: account.balanceParsed ?? account.balance ?? '0',
      balanceRaw: account.balance,
    });
  }
  const aggregateBalance = items
    .reduce((sum, item) => sum.plus(item.balance), new BigNumber(0))
    .toFixed();
  return {
    aggregate: {
      symbol: chainConfig.nativeSymbol,
      balance: aggregateBalance,
      contractAddress: '',
      isNative: true,
    },
    items,
  };
}

export async function fetchBtcExternalAddressBalance(
  chainConfig: IChainConfig,
  addressInput: string,
) {
  const address = assertAddressForChain(chainConfig, addressInput);
  const account = await fetchBtcNativeAccount(chainConfig.networkId, address);
  return {
    address,
    balance: account.balanceParsed ?? account.balance ?? '0',
    balanceRaw: account.balance,
  };
}
```

- [ ] **Step 4: Update balance command**

Modify BTC branch in `apps/cli/src/commands/balance.ts`:

```ts
if (!isEvmChain(chainConfig)) {
  if (options.address && options.addressType) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      '--address cannot be combined with --address-type for BTC/TBTC balance.',
      'Use either --address for external read-only or --address-type for the logged-in wallet.',
    );
  }
  if (options.address) {
    const external = await fetchBtcExternalAddressBalance(chainConfig, options.address);
    output.success(
      {
        address: external.address,
        chain: chainName,
        tokens: [
          {
            symbol: chainConfig.nativeSymbol,
            balance: external.balance,
            contractAddress: '',
            fiatValue: null,
            isNative: true,
          },
        ],
      },
      { chain: chainName },
    );
    return;
  }
  const derived = await fetchBtcDerivedBalances(
    chainConfig,
    options.addressType ? assertBtcAddressType(options.addressType) : undefined,
  );
  output.success(
    {
      chain: chainName,
      aggregate: derived.aggregate,
      items: derived.items,
    },
    { chain: chainName },
  );
  return;
}
```

Add `.option('--address-type <type>', 'BTC address type: taproot | native-segwit | nested-segwit | legacy')` and extend the action options type.

- [ ] **Step 5: Update history command**

Use `deriveBtcAddress` and `listBtcAddressTypeInfos` to query one or all derived BTC addresses. For aggregate history, fetch each address with the same `limit`, flatten, sort by timestamp descending, and return an object:

```ts
{
  chain: options.chain,
  aggregate: true,
  items,
  addressTypes: [
    { addressType: 'taproot', address: 'tb1...', count: 3 },
  ],
}
```

Keep external `--address` output as the existing array shape to avoid breaking read-only e2e fixtures.

- [ ] **Step 6: Update schemas**

Modify `apps/cli/src/schemas/balance-schema.ts` so `balanceInputSchema` includes `addressType: btcAddressType.optional()`. Update the description for `address` to remove "Required for btc/tbtc in this round."

Modify `apps/cli/src/schemas/wallet-history-schema.ts` similarly.

- [ ] **Step 7: Run derived read tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/balance-btc-derived.test.ts \
  apps/cli/src/__tests__/history-btc-derived.test.ts \
  apps/cli/src/__tests__/balance-btc-readonly.test.ts \
  apps/cli/src/__tests__/history-btc-readonly.test.ts
```

Expected: PASS. Existing external-address read-only tests must still pass.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/core/btc/account.ts apps/cli/src/commands/balance.ts apps/cli/src/commands/wallet-history.ts apps/cli/src/schemas/balance-schema.ts apps/cli/src/schemas/wallet-history-schema.ts apps/cli/src/__tests__/balance-btc-derived.test.ts apps/cli/src/__tests__/history-btc-derived.test.ts apps/cli/src/__tests__/balance-btc-readonly.test.ts apps/cli/src/__tests__/history-btc-readonly.test.ts
git commit -m "feat(cli): add btc derived balance and history"
```

### Task 6: BTC Transaction Builder

**Files:**
- Create: `apps/cli/src/core/btc/tx-builder.ts`
- Test: `apps/cli/src/__tests__/btc-tx-builder.test.ts`
- Reference: `packages/kit-bg/src/vaults/impls/btc/Vault.ts`
- Reference: `packages/core/src/chains/btc/CoreChainSoftware.tbtc.test.ts`

- [ ] **Step 1: Write failing tx-builder tests**

Add `apps/cli/src/__tests__/btc-tx-builder.test.ts`:

```ts
import { EAddressEncodings } from '@onekeyhq/core/src/types';

import { buildBtcTransferTxForTest } from '../core/btc/tx-builder';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(async (_scope, path, params) => {
      if (path === '/wallet/v1/account/get-account') {
        return {
          address: params.accountAddress,
          balance: '136122',
          balanceParsed: '0.00136122',
          utxoList: [
            {
              txid: '39cb45de185e5fa1778a171cccb22338dada5d6105c4f843a7542d5a9b79ed90',
              vout: 1,
              value: '136122',
              address: params.accountAddress,
              path: "m/86'/1'/0'/0/0",
              confirmations: 6,
            },
          ],
        };
      }
      return {};
    }),
  },
}));

describe('BTC tx builder', () => {
  it('builds single-output tbtc tx with change back to receive address', async () => {
    const result = await buildBtcTransferTxForTest({
      networkId: 'tbtc--0',
      impl: 'tbtc',
      nativeDecimals: 8,
      fromAddress: 'tb1pfrom',
      fromPath: "m/86'/1'/0'/0/0",
      addressTypeInfo: {
        addressType: 'taproot',
        label: 'Taproot',
        deriveType: 'BIP86',
        addressEncoding: EAddressEncodings.P2TR,
        purpose: 86,
        coinType: 1,
        accountPath: "m/86'/1'/0'",
        path: "m/86'/1'/0'/0/0",
        relPath: '0/0',
      },
      to: 'tb1pfrom',
      amount: '0.00001',
    });

    expect(result.encodedTx.inputs).toHaveLength(1);
    expect(result.encodedTx.outputs[0]).toMatchObject({
      address: 'tb1pfrom',
      value: '1000',
    });
    expect(result.btcExtraInfo.pathToAddresses["m/86'/1'/0'/0/0"]).toMatchObject({
      address: 'tb1pfrom',
      relPath: '0/0',
    });
    expect(result.btcExtraInfo.inputAddressesEncodings).toEqual([
      EAddressEncodings.P2TR,
    ]);
    expect(result.relPaths).toEqual(['0/0']);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-tx-builder.test.ts
```

Expected: FAIL because `tx-builder.ts` does not exist.

- [ ] **Step 3: Implement minimal tx builder**

Create `apps/cli/src/core/btc/tx-builder.ts`. Import `coinSelectWithWitness` and `EOutputsTypeForCoinSelect` from `@onekeyhq/core/src/utils/coinSelectUtils` if available in this workspace. If the export path differs, use the same import path as `packages/kit-bg/src/vaults/impls/btc/Vault.ts`.

The public function signature:

```ts
export interface IBuildBtcTransferTxParams {
  networkId: string;
  impl: 'btc' | 'tbtc';
  nativeDecimals: number;
  fromAddress: string;
  fromPath: string;
  addressTypeInfo: IBtcAddressTypeInfo;
  to: string;
  amount: string;
}

export async function buildBtcTransferTx(
  params: IBuildBtcTransferTxParams,
): Promise<{
  encodedTx: IEncodedTxBtc;
  btcExtraInfo: ICoreApiSignBtcExtraInfo;
  relPaths: string[];
  summary: {
    fee: string;
    txSize: number | undefined;
    inputCount: number;
    outputCount: number;
  };
}> {
  const account = await apiClient.get<{
    utxoList?: Array<{
      txid: string;
      vout: number;
      value: string;
      address?: string;
      path?: string;
      confirmations?: number;
    }>;
  }>('wallet', '/wallet/v1/account/get-account', {
    networkId: params.networkId,
    accountAddress: params.fromAddress,
    withUTXOList: true,
    withNetWorth: true,
  });

  const utxos = account.utxoList ?? [];
  if (utxos.length === 0) {
    throw new AppError(
      ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
      'No usable BTC UTXOs found.',
      'Fund the selected BTC address type before sending.',
    );
  }

  const amountSats = amountToSmallestUnit(params.amount, params.nativeDecimals);
  const inputsForCoinSelect = utxos.map((utxo) => ({
    txId: utxo.txid,
    vout: utxo.vout,
    value: Number(utxo.value),
    amount: utxo.value,
    address: utxo.address ?? params.fromAddress,
    path: utxo.path ?? params.fromPath,
    confirmations: utxo.confirmations,
  }));
  const outputsForCoinSelect = [
    {
      type: EOutputsTypeForCoinSelect.Payment,
      address: params.to,
      value: Number(amountSats),
      amount: amountSats,
    },
  ];
  const selected = coinSelectWithWitness({
    inputsForCoinSelect,
    outputsForCoinSelect,
    feeRate: '1',
    network: getBtcForkNetwork(params.impl),
    changeAddress: params.fromAddress,
    txType: params.addressTypeInfo.addressEncoding,
  });
  const encodedTx = {
    inputs: selected.inputs,
    outputs: selected.outputs,
    inputsForCoinSelect,
    outputsForCoinSelect,
    fee: String(selected.fee),
    txSize: selected.bytes,
  } as IEncodedTxBtc;
  const btcExtraInfo: ICoreApiSignBtcExtraInfo = {
    pathToAddresses: {
      [params.fromPath]: {
        address: params.fromAddress,
        relPath: params.addressTypeInfo.relPath,
        fullPath: params.fromPath,
      },
    },
    addressToPath: {
      [params.fromAddress]: {
        address: params.fromAddress,
        relPath: params.addressTypeInfo.relPath,
        fullPath: params.fromPath,
      },
    },
    inputAddressesEncodings: [params.addressTypeInfo.addressEncoding],
    nonWitnessPrevTxs: {},
  };
  return {
    encodedTx,
    btcExtraInfo,
    relPaths: [params.addressTypeInfo.relPath],
    summary: {
      fee: String(selected.fee),
      txSize: selected.bytes,
      inputCount: selected.inputs?.length ?? 0,
      outputCount: selected.outputs?.length ?? 0,
    },
  };
}
```

Also export `buildBtcTransferTxForTest = buildBtcTransferTx`.

- [ ] **Step 4: Run tx-builder test**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/btc-tx-builder.test.ts
```

Expected: PASS. If `coinSelectWithWitness` returns slightly different output shape, adjust the test to assert required invariants: one input, payment output amount, `btcExtraInfo`, and rel path.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/core/btc/tx-builder.ts apps/cli/src/__tests__/btc-tx-builder.test.ts
git commit -m "feat(cli): add btc transfer tx builder"
```

### Task 7: BTC/TBTC Transfer Command

**Files:**
- Modify: `apps/cli/src/commands/transfer.ts`
- Modify: `apps/cli/src/schemas/transfer-schema.ts`
- Test: `apps/cli/src/__tests__/transfer-btc.test.ts`
- Test: `apps/cli/src/__tests__/btc-capability-gates.test.ts`

- [ ] **Step 1: Write failing transfer tests**

Add `apps/cli/src/__tests__/transfer-btc.test.ts`:

```ts
jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(async () => ({
    getAddress: jest.fn(async () => ({
      address: 'tb1pfrom',
      path: "m/86'/1'/0'",
      publicKey: '02abcd',
    })),
    signTransaction: jest.fn(async () => ({
      rawTx: '02000000',
      txid: 'd'.repeat(64),
    })),
  })),
}));

jest.mock('../core/btc/tx-builder', () => ({
  buildBtcTransferTx: jest.fn(async () => ({
    encodedTx: { inputs: [], outputs: [], fee: '100', txSize: 120 },
    btcExtraInfo: { pathToAddresses: {}, addressToPath: {} },
    relPaths: ['0/0'],
    summary: { fee: '100', txSize: 120, inputCount: 1, outputCount: 2 },
  })),
}));

jest.mock('../infra', () => ({
  apiClient: {
    setEnv: jest.fn(),
    post: jest.fn(async () => ({ result: 'e'.repeat(64) })),
  },
}));

describe('BTC transfer command', () => {
  it('requires address-type for tbtc transfer', async () => {
    const result = await runCliJson([
      'transfer',
      '--chain',
      'tbtc',
      '--to',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--amount',
      '0.00001',
      '--dry-run',
    ]);
    expect(result.status).toBe('error');
    expect(result.error.message).toContain('--address-type');
  });

  it('dry-runs tbtc transfer without signing', async () => {
    const result = await runCliJson([
      'transfer',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--to',
      'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
      '--amount',
      '0.00001',
      '--dry-run',
    ]);
    expect(result.status).toBe('success');
    expect(result.data).toMatchObject({
      chain: 'tbtc',
      addressType: 'taproot',
      dryRun: true,
      fee: '100',
    });
  });
});
```

Use existing CLI integration helpers from `apps/cli/src/__tests__/cli.integration.test.ts`; if there is no exported helper, add a local `runCliJson` in this test that executes `apps/cli/bin/onekey` with `NODE_ENV=test`.

- [ ] **Step 2: Run failing tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/transfer-btc.test.ts
```

Expected: FAIL because transfer still asserts `evmTransfer`.

- [ ] **Step 3: Update schema**

Modify `apps/cli/src/schemas/transfer-schema.ts`:

```ts
import { btcAddressType, chainAddress, chainId, humanAmount } from './common';

export const transferInputSchema = z.object({
  to: chainAddress.describe('Recipient address'),
  amount: humanAmount.describe('Human-readable amount to send.'),
  token: ethAddress.optional().describe('ERC-20 contract address. EVM only.'),
  chain: chainId.optional().describe('Target chain. Defaults to last used.'),
  addressType: btcAddressType
    .optional()
    .describe('BTC/TBTC sender address type. Required for BTC/TBTC transfer.'),
  dryRun: z.boolean().optional().describe('Estimate without sending'),
  yes: z.boolean().optional().describe('Skip confirmation prompt'),
});
```

Keep the existing EVM token validation for `token`; BTC branch rejects `token`.

- [ ] **Step 4: Implement BTC branch before EVM branch**

In `apps/cli/src/commands/transfer.ts`, after resolving `chainConfig`, branch:

```ts
if (!isEvmChain(rawChainConfig)) {
  assertChainCapability(rawChainConfig, 'btcTransfer', 'transfer');
  if (!validated.addressType) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      'BTC/TBTC transfer requires --address-type.',
      'Use --address-type taproot|native-segwit|nested-segwit|legacy.',
    );
  }
  if (validated.token) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_TOKEN.code,
      'BTC/TBTC transfer only supports the native token.',
      'Omit --token.',
    );
  }
  const addressType = assertBtcAddressType(validated.addressType);
  const info = getBtcAddressTypeInfo(rawChainConfig.impl, addressType);
  const signer = await getSignerByImpl(rawChainConfig.impl);
  const addressInfo = await signer.getAddress(rawChainConfig.networkId, {
    addressType,
  });
  const fromAddress = addressInfo.address;
  const fromPath = info.path;
  const to = assertAddressForChain(rawChainConfig, validated.to);
  const built = await buildBtcTransferTx({
    networkId: rawChainConfig.networkId,
    impl: rawChainConfig.impl as 'btc' | 'tbtc',
    nativeDecimals: rawChainConfig.nativeDecimals,
    fromAddress,
    fromPath,
    addressTypeInfo: info,
    to,
    amount: validated.amount,
  });
  if (validated.dryRun) {
    output.success({
      action: `Transfer ${validated.amount} ${rawChainConfig.nativeSymbol}`,
      from: fromAddress,
      to,
      amount: validated.amount,
      chain: chainName,
      addressType,
      fee: built.summary.fee,
      txSize: built.summary.txSize,
      inputCount: built.summary.inputCount,
      outputCount: built.summary.outputCount,
      dryRun: true,
    });
    return;
  }
  await confirmTransaction({
    info: {
      action: `Transfer ${validated.amount} ${rawChainConfig.nativeSymbol}`,
      to,
      value: validated.amount,
      network: chainName,
      estimatedGas: `${built.summary.fee} sats`,
    },
    output,
    skipConfirmation,
  });
  const signedTx = await signer.signTransaction({
    networkId: rawChainConfig.networkId,
    account: {
      address: fromAddress,
      path: fromPath,
      pub: addressInfo.publicKey,
    },
    unsignedTx: { encodedTx: built.encodedTx as unknown as Record<string, unknown> },
    btcExtraInfo: built.btcExtraInfo,
    relPaths: built.relPaths,
    addressType,
  });
  const broadcastResult = await apiClient.post<ISendTransactionResult>(
    'wallet',
    '/wallet/v1/account/send-transaction',
    {
      networkId: rawChainConfig.networkId,
      accountAddress: fromAddress,
      tx: signedTx.rawTx,
    },
  );
  const BTC_TXID_PATTERN = /^[a-fA-F0-9]{64}$/;
  if (!broadcastResult?.result || !BTC_TXID_PATTERN.test(broadcastResult.result)) {
    throw new AppError(
      ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
      `Broadcast returned invalid BTC txid: "${broadcastResult?.result ?? ''}"`,
      'Check the transaction on chain explorer manually',
    );
  }
  output.success({
    txid: broadcastResult.result,
    from: fromAddress,
    to,
    amount: validated.amount,
    chain: chainName,
    addressType,
  }, { chain: chainName });
  return;
}
```

Keep the existing EVM code path unchanged after this branch.

- [ ] **Step 5: Update capability gate tests**

Modify `apps/cli/src/__tests__/btc-capability-gates.test.ts`: replace the old "rejects tbtc transfer before tx construction" expectation with missing address-type and invalid address-type errors. Keep security and token-market negative gates.

- [ ] **Step 6: Run transfer tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/transfer-btc.test.ts \
  apps/cli/src/__tests__/transfer-schema.test.ts \
  apps/cli/src/__tests__/btc-capability-gates.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/commands/transfer.ts apps/cli/src/schemas/transfer-schema.ts apps/cli/src/__tests__/transfer-btc.test.ts apps/cli/src/__tests__/transfer-schema.test.ts apps/cli/src/__tests__/btc-capability-gates.test.ts
git commit -m "feat(cli): add btc native transfer"
```

### Task 8: Swap Networks And Native BTC Token Resolution

**Files:**
- Modify: `apps/cli/src/commands/swap/swap-networks.ts`
- Modify: `apps/cli/src/core/token-resolver.ts`
- Test: `apps/cli/src/__tests__/swap-networks.test.ts`
- Test: `apps/cli/src/__tests__/token-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

Update `apps/cli/src/__tests__/swap-networks.test.ts`:

```ts
it('returns backend-supported BTC networks from API', async () => {
  mockApiGet.mockResolvedValueOnce([
    {
      networkId: 'btc--0',
      supportSingleSwap: false,
      supportCrossChainSwap: true,
      supportLimit: false,
    },
  ]);
  const networks = await fetchSwapNetworks();
  expect(networks).toEqual([
    expect.objectContaining({
      networkId: 'btc--0',
      nativeSymbol: 'BTC',
      supportCrossChainSwap: true,
    }),
  ]);
});
```

Update `apps/cli/src/__tests__/token-resolver.test.ts`:

```ts
it('resolves native BTC without EVM market search', async () => {
  const result = await resolveToken('BTC', 'btc');
  expect(result).toMatchObject({
    contractAddress: '',
    symbol: 'BTC',
    decimals: 8,
    isNative: true,
    networkId: 'btc--0',
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/swap-networks.test.ts \
  apps/cli/src/__tests__/token-resolver.test.ts
```

Expected: FAIL because swap networks still skips non-EVM.

- [ ] **Step 3: Remove EVM-only swap network filter**

Modify `apps/cli/src/commands/swap/swap-networks.ts` loop:

```ts
for (const net of res) {
  if (typeof net.networkId !== 'string') {
    continue;
  }
  const preset = presetMap.get(net.networkId);
  if (!preset) {
    continue;
  }
  results.push({
    networkId: net.networkId,
    name: preset.name,
    chainId: preset.chainId,
    nativeSymbol: preset.symbol,
    supportSingleSwap: !!net.supportSingleSwap,
    supportCrossChainSwap: !!net.supportCrossChainSwap,
    supportLimit: !!net.supportLimit,
  });
}
```

- [ ] **Step 4: Keep BTC token resolution native-only**

Modify `apps/cli/src/core/token-resolver.ts` so native-token path already handles BTC/TBTC. Before `searchAndResolve`, add:

```ts
if (chainConfig.impl === 'btc' || chainConfig.impl === 'tbtc') {
  throw new AppError(
    ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
    `Only native ${nativeSymbol} is supported on ${chain}`,
    `Use ${nativeSymbol} as the token symbol.`,
  );
}
```

This prevents BTC symbol text from going through EVM market search.

- [ ] **Step 5: Run tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/swap-networks.test.ts \
  apps/cli/src/__tests__/token-resolver.test.ts \
  apps/cli/src/__tests__/chain-resolution-smoke.test.ts
```

Expected: PASS. Update smoke expectations that previously asserted swap networks filters non-EVM.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/commands/swap/swap-networks.ts apps/cli/src/core/token-resolver.ts apps/cli/src/__tests__/swap-networks.test.ts apps/cli/src/__tests__/token-resolver.test.ts apps/cli/src/__tests__/chain-resolution-smoke.test.ts
git commit -m "feat(cli): allow btc swap networks"
```

### Task 9: Swap Quote And Build BTC Address Metadata

**Files:**
- Modify: `apps/cli/src/commands/swap/swap-quote.ts`
- Modify: `apps/cli/src/commands/swap/swap-build.ts`
- Modify: `apps/cli/src/core/pending-storage.ts`
- Modify: `apps/cli/src/schemas/swap-schemas.ts`
- Test: `apps/cli/src/__tests__/swap-btc-address-types.test.ts`

- [ ] **Step 1: Write failing swap address-type tests**

Add `apps/cli/src/__tests__/swap-btc-address-types.test.ts`:

```ts
jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(async () => ({
    getAddress: jest.fn(async (_networkId, options) => ({
      address:
        options?.addressType === 'taproot'
          ? 'bc1pfrom'
          : 'bc1qto',
      path:
        options?.addressType === 'taproot'
          ? "m/86'/0'/0'"
          : "m/84'/0'/0'",
    })),
  })),
}));

describe('BTC swap address-type requirements', () => {
  it('requires from-address-type when btc is source', async () => {
    const result = await runCliJson([
      'swap',
      'quote',
      '--chain',
      'btc',
      '--to-chain',
      'eth',
      '--from',
      'BTC',
      '--to',
      'ETH',
      '--amount',
      '0.0001',
    ]);
    expect(result.status).toBe('error');
    expect(result.error.message).toContain('--from-address-type');
  });

  it('requires to-address-type when btc is destination', async () => {
    const result = await runCliJson([
      'swap',
      'quote',
      '--chain',
      'eth',
      '--to-chain',
      'btc',
      '--from',
      'ETH',
      '--to',
      'BTC',
      '--amount',
      '0.001',
    ]);
    expect(result.status).toBe('error');
    expect(result.error.message).toContain('--to-address-type');
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/swap-btc-address-types.test.ts
```

Expected: FAIL because swap commands do not accept BTC address-type flags.

- [ ] **Step 3: Add BTC swap address resolver helper**

Inside `swap-quote.ts` or a new `apps/cli/src/commands/swap/swap-btc-address.ts`, add:

```ts
export async function resolveBtcSwapAddress(params: {
  chainConfig: IChainConfig;
  addressTypeInput: string | undefined;
  flagName: '--from-address-type' | '--to-address-type';
}) {
  if (!isBtcImpl(params.chainConfig.impl)) return undefined;
  if (!params.addressTypeInput) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      `BTC/TBTC swap requires ${params.flagName}.`,
      `Use ${params.flagName} taproot|native-segwit|nested-segwit|legacy.`,
    );
  }
  const addressType = assertBtcAddressType(params.addressTypeInput);
  const info = getBtcAddressTypeInfo(params.chainConfig.impl, addressType);
  const signer = await getSignerByImpl(params.chainConfig.impl);
  const address = await signer.getAddress(params.chainConfig.networkId, {
    addressType,
  });
  return {
    addressType,
    addressEncoding: info.addressEncoding,
    deriveType: info.deriveType,
    address: address.address,
    path: info.path,
  };
}
```

- [ ] **Step 4: Update quote command**

Add options:

```ts
.option('--from-address-type <type>', 'BTC/TBTC source address type')
.option('--to-address-type <type>', 'BTC/TBTC destination address type')
```

After resolving `chainConfig` and `toChainConfig`, call `resolveBtcSwapAddress` for BTC-family source and destination. Set quote params:

```ts
if (fromBtcAddress) {
  quoteParams.userAddress = fromBtcAddress.address;
}
if (toBtcAddress) {
  quoteParams.receivingAddress = toBtcAddress.address;
}
if (!toBtcAddress && walletAddress) {
  quoteParams.receivingAddress = walletAddress;
}
```

For EVM-only routes, preserve current optional wallet address behavior.

Include metadata:

```ts
btcAddressing: {
  from: fromBtcAddress ?? null,
  to: toBtcAddress ?? null,
}
```

- [ ] **Step 5: Update build command and pending order**

Add the same flags to `swap-build.ts`, derive BTC addresses before quote/build, and set `userAddress` and `receivingAddress` exactly as quote does.

Modify `apps/cli/src/core/pending-storage.ts`:

```ts
export interface IPendingBtcAddressMeta {
  addressType: string;
  addressEncoding: string;
  deriveType: string;
  address: string;
  path: string;
}

export interface IPendingOrder {
  ...
  btcAddressing?: {
    from?: IPendingBtcAddressMeta | null;
    to?: IPendingBtcAddressMeta | null;
  };
}
```

Persist `btcAddressing` in `savePending`.

Allow update extras to include `btcAddressing` only during initial save; do not add it to `UPDATE_EXTRA_ALLOWLIST`.

- [ ] **Step 6: Update schemas**

Modify `apps/cli/src/schemas/swap-schemas.ts` inputs to include `fromAddressType` and `toAddressType`. Add optional `btcAddressing` metadata to quote/build outputs.

- [ ] **Step 7: Run swap quote/build tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/swap-btc-address-types.test.ts \
  apps/cli/src/__tests__/swap-protocol-config.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/commands/swap apps/cli/src/core/pending-storage.ts apps/cli/src/schemas/swap-schemas.ts apps/cli/src/__tests__/swap-btc-address-types.test.ts
git commit -m "feat(cli): add btc swap address metadata"
```

### Task 10: BTC Swap Execute PSBT Path

**Files:**
- Modify: `apps/cli/src/commands/swap/swap-execute.ts`
- Test: `apps/cli/src/__tests__/swap-execute-btc.test.ts`

- [ ] **Step 1: Write failing execute tests**

Add `apps/cli/src/__tests__/swap-execute-btc.test.ts`:

```ts
import { _setPendingDirForTest, savePending } from '../core/pending-storage';

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(async () => ({
    getAddress: jest.fn(async () => ({
      address: 'bc1pfrom',
      path: "m/86'/0'/0'",
      publicKey: '02abcd',
    })),
    signTransaction: jest.fn(async () => ({
      rawTx: '02000000',
      txid: 'f'.repeat(64),
    })),
  })),
}));

jest.mock('../infra', () => ({
  apiClient: {
    setEnv: jest.fn(),
    post: jest.fn(async () => ({ result: 'f'.repeat(64) })),
  },
}));

describe('BTC swap execute', () => {
  it('rejects psbt address type mismatch', async () => {
    _setPendingDirForTest('/tmp/onekey-cli-test-pending');
    savePending('btc-order', {
      orderId: 'btc-order',
      status: 'pending',
      chain: 'btc',
      networkId: 'btc--0',
      toNetworkId: 'evm--1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fromToken: { contractAddress: '', symbol: 'BTC', decimals: 8 },
      toToken: { contractAddress: '', symbol: 'ETH', decimals: 18 },
      amount: '0.0001',
      provider: 'provider',
      txData: {
        result: { info: { provider: 'provider' } },
        btcData: { hexStr: '70736274ff', addressType: ['P2WPKH'] },
      },
      btcAddressing: {
        from: {
          addressType: 'taproot',
          addressEncoding: 'P2TR',
          deriveType: 'BIP86',
          address: 'bc1pfrom',
          path: "m/86'/0'/0'/0/0",
        },
      },
    });
    const result = await runCliJson([
      'swap',
      'execute',
      '--chain',
      'btc',
      '--from-address-type',
      'taproot',
      '--order',
      'btc-order',
      '--yes',
    ]);
    expect(result.status).toBe('error');
    expect(result.error.message).toContain('derivation');
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/swap-execute-btc.test.ts
```

Expected: FAIL because execute still requires EVM `tx`.

- [ ] **Step 3: Add BTC execute branch before EVM tx validation**

In `swap-execute.ts`, after loading and validating the order but before EVM `txData.tx` validation:

```ts
const isBtcSource = chainConfig.impl === 'btc' || chainConfig.impl === 'tbtc';
if (isBtcSource) {
  const fromAddressMeta = order.btcAddressing?.from;
  if (!fromAddressMeta) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      'BTC order is missing source address metadata.',
      'Run "onekey swap build" again.',
    );
  }
  const requestedAddressType = assertBtcAddressType(
    options.fromAddressType ?? fromAddressMeta.addressType,
  );
  if (requestedAddressType !== fromAddressMeta.addressType) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Order was built for ${fromAddressMeta.addressType}, but execute used ${requestedAddressType}.`,
      `Use --from-address-type ${fromAddressMeta.addressType}.`,
    );
  }
  const btcData = (order.txData as Record<string, unknown>).btcData as
    | { hexStr?: string; addressType?: string[] }
    | undefined;
  if (!btcData?.hexStr || !Array.isArray(btcData.addressType)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      'BTC order does not contain PSBT data.',
      'Run "onekey swap build" again.',
    );
  }
  if (!btcData.addressType.includes(fromAddressMeta.addressEncoding)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `BTC derivation path restriction: route supports ${btcData.addressType.join(', ')}, selected ${fromAddressMeta.addressEncoding}.`,
      'Build the swap with a supported --from-address-type.',
    );
  }
  const signer = await getSignerByImpl(chainConfig.impl);
  const addressInfo = await signer.getAddress(chainConfig.networkId, {
    addressType: requestedAddressType,
  });
  if (addressInfo.address !== fromAddressMeta.address) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Wallet address mismatch: order was built for ${fromAddressMeta.address}, current wallet is ${addressInfo.address}.`,
      'Run "onekey swap build" again with the current wallet.',
    );
  }
  await confirmTransaction({
    info: {
      action: `Swap ${order.amount} ${order.fromToken.symbol} → ${order.toToken.symbol}`,
      to: order.provider ?? 'swap provider',
      value: `${order.amount} ${order.fromToken.symbol}`,
      network: options.chain,
    },
    output,
    skipConfirmation,
  });
  const signed = await signer.signTransaction({
    networkId: chainConfig.networkId,
    account: {
      address: fromAddressMeta.address,
      path: fromAddressMeta.path,
      pub: addressInfo.publicKey,
    },
    addressType: requestedAddressType,
    unsignedTx: {
      encodedTx: {
        psbtHex: btcData.hexStr,
        inputsToSign: [],
      },
    },
    signOnly: true,
  });
  const broadcastResult = await apiClient.post<ISendTransactionResult>(
    'wallet',
    '/wallet/v1/account/send-transaction',
    {
      networkId: chainConfig.networkId,
      accountAddress: fromAddressMeta.address,
      tx: signed.rawTx,
    },
  );
  const BTC_TXID_PATTERN = /^[a-fA-F0-9]{64}$/;
  if (!broadcastResult?.result || !BTC_TXID_PATTERN.test(broadcastResult.result)) {
    throw new AppError(
      ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
      `BTC swap broadcast returned invalid txid: "${broadcastResult?.result ?? ''}"`,
      'Check the transaction on chain explorer manually.',
    );
  }
  updatePendingStatus(options.order, 'executed', {
    txHash: broadcastResult.result,
  });
  output.success({
    orderId: options.order,
    status: 'executed',
    txHash: broadcastResult.result,
    chain: order.chain,
    from: order.fromToken.symbol,
    to: order.toToken.symbol,
    amount: order.amount,
    addressType: requestedAddressType,
    message: 'BTC swap transaction broadcast successfully.',
  });
  return;
}
```

Add `.option('--from-address-type <type>', 'BTC/TBTC source address type')` to execute command.

- [ ] **Step 4: Run execute tests**

```bash
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath apps/cli/src/__tests__/swap-execute-btc.test.ts apps/cli/src/__tests__/swap-bridge-status.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/swap/swap-execute.ts apps/cli/src/__tests__/swap-execute-btc.test.ts
git commit -m "feat(cli): execute btc swap psbt"
```

### Task 11: `onekey-tools` cli-e2e Coverage

**Files:**
- Modify: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/config.ts`
- Modify: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/index.ts`
- Modify: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/schemas.ts`
- Modify: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/sections/read-only.ts`
- Create: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/sections/testnet-spend/btc-transfer.ts`
- Modify: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/docs/runbooks/mac-mini-setup.md`
- Test: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/index.test.ts`
- Test: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/sections/read-only.test.ts`
- Test: `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/schemas.test.ts`

- [ ] **Step 1: Write failing cli-e2e tests**

Update `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e/src/suites/cli-integration/index.test.ts`:

```ts
test('safe profile includes btc testnet dry-run coverage', () => {
  assert.deepEqual(getSections('safe').map((section) => section.name), [
    'preflight-auth',
    'read-only',
    'preflight-testnet',
    'transfer-sepolia',
    'transfer-tbtc',
  ]);
});
```

Update read-only tests to expect:

```ts
assert.ok(checks.some((check) => check.label === 'wallet-btc-address-types'));
assert.ok(checks.some((check) => check.label === 'wallet-tbtc-address-taproot'));
assert.ok(checks.some((check) => check.label === 'tbtc-transfer-missing-address-type'));
assert.ok(!checks.some((check) => check.label === 'tbtc-transfer-unsupported'));
```

- [ ] **Step 2: Run failing cli-e2e unit tests**

```bash
cd /Users/leon/Documents/onekey/onekey-tools
yarn workspace @onekey/cli-e2e test
```

Expected: FAIL because the new section and read-only checks do not exist.

- [ ] **Step 3: Add config**

Modify `config.ts`:

```ts
export const BTC_ADDRESS_TYPES = [
  'taproot',
  'native-segwit',
  'nested-segwit',
  'legacy',
] as const;

export const BTC_TESTNET_SPEND = {
  enabled: process.env.ONEKEY_CLI_E2E_ALLOW_TBTC_SPEND === '1',
  chain: 'tbtc',
  addressType: process.env.ONEKEY_CLI_E2E_TBTC_ADDRESS_TYPE ?? 'taproot',
  amount: process.env.ONEKEY_CLI_E2E_TBTC_TRANSFER_AMOUNT ?? '0.00001',
} as const;
```

- [ ] **Step 4: Update read-only section**

In `read-only.ts`, add checks:

```ts
{
  label: 'wallet-btc-address-types',
  args: ['wallet', 'address-types', '--chain', 'btc'],
  validateSuccess: validateAddressTypes,
},
{
  label: 'wallet-tbtc-address-taproot',
  args: ['wallet', 'address', '--chain', 'tbtc', '--address-type', 'taproot'],
  validateSuccess: validateWalletAddress,
},
{
  label: 'tbtc-transfer-missing-address-type',
  expectFailure: true,
  args: [
    'transfer',
    '--chain',
    config.chain,
    '--to',
    config.address,
    '--amount',
    '0.00001',
    '--dry-run',
  ],
  validateFailure: validateMissingAddressTypeFailure,
},
{
  label: 'tbtc-transfer-invalid-address-type',
  expectFailure: true,
  args: [
    'transfer',
    '--chain',
    config.chain,
    '--address-type',
    'segwit',
    '--to',
    config.address,
    '--amount',
    '0.00001',
    '--dry-run',
  ],
  validateFailure: validateInvalidAddressTypeFailure,
},
```

Remove `tbtc-transfer-unsupported`.

Add validators that check success data contains all four address types and failure messages mention `--address-type` or "Invalid BTC address type".

- [ ] **Step 5: Add TBTC transfer section**

Create `sections/testnet-spend/btc-transfer.ts`:

```ts
import { baseResponseSchema, transferSchema } from '../../schemas';
import { runOnekeyJson } from '../../onekey-cli';
import { BTC_TESTNET_FIXTURES, BTC_TESTNET_SPEND } from '../../config';
import type { SectionDefinition, SectionOutcome } from '../../section-runner';

export const transferTbtcSection: SectionDefinition = {
  name: 'transfer-tbtc',
  async run(): Promise<SectionOutcome> {
    const messages: string[] = [];
    const dryRun = await runOnekeyJson(baseResponseSchema, [
      'transfer',
      '--chain',
      BTC_TESTNET_SPEND.chain,
      '--address-type',
      BTC_TESTNET_SPEND.addressType,
      '--to',
      BTC_TESTNET_FIXTURES.address,
      '--amount',
      BTC_TESTNET_SPEND.amount,
      '--dry-run',
    ]);
    if (dryRun.payload.status !== 'success') {
      return {
        pass: false,
        failureClass: 'hard-fail',
        messages: [`tbtc dry-run failed: ${dryRun.payload.status}`],
      };
    }
    messages.push('tbtc dry-run transfer: ok');

    if (!BTC_TESTNET_SPEND.enabled) {
      messages.push('tbtc broadcast skipped: ONEKEY_CLI_E2E_ALLOW_TBTC_SPEND is not 1');
      return { pass: true, messages };
    }

    const broadcast = await runOnekeyJson(transferSchema, [
      'transfer',
      '--chain',
      BTC_TESTNET_SPEND.chain,
      '--address-type',
      BTC_TESTNET_SPEND.addressType,
      '--to',
      BTC_TESTNET_FIXTURES.address,
      '--amount',
      BTC_TESTNET_SPEND.amount,
      '--yes',
    ]);
    if (broadcast.payload.status !== 'success') {
      const msg =
        broadcast.payload.status === 'error'
          ? broadcast.payload.error.message
          : 'unknown';
      return {
        pass: false,
        failureClass: 'hard-fail',
        messages: [`tbtc broadcast failed: ${msg}`],
      };
    }
    messages.push(`tbtc broadcast: ${broadcast.payload.data.txid}`);
    return { pass: true, messages };
  },
};
```

- [ ] **Step 6: Register TBTC section**

Modify `index.ts` to import `transferTbtcSection` and include it after `transferSepoliaSection` for `safe` and `testnet-spend`.

- [ ] **Step 7: Update schemas**

Update `schemas.ts`:

```ts
export const btcAddressTypeItemSchema = z
  .object({
    addressType: z.enum(['taproot', 'native-segwit', 'nested-segwit', 'legacy']),
    address: z.string().optional(),
    balance: z.string().optional(),
  })
  .passthrough();

export const transferDataSchema = z
  .object({
    txid: z.string().regex(/^(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})$/),
    from: z.string(),
    to: z.string(),
    amount: z.string(),
    chain: z.string(),
  })
  .passthrough();
```

Allow balance data to have either existing `{ address, chain, tokens }` or BTC aggregate `{ chain, aggregate, items }`.

- [ ] **Step 8: Update runbook**

Append to `docs/runbooks/mac-mini-setup.md`:

```md
### BTC/TBTC transfer and swap coverage

The safe profile runs BTC/TBTC read-only checks and a TBTC transfer dry-run:

```bash
ONEKEY_APP_MONOREPO_DIR=/Users/leon/Documents/onekey/app-monorepo \
  yarn cli-e2e:cli-integration:local-cli
```

TBTC broadcast is opt-in:

```bash
ONEKEY_CLI_E2E_ALLOW_TBTC_SPEND=1 \
ONEKEY_CLI_E2E_TBTC_ADDRESS_TYPE=taproot \
ONEKEY_CLI_E2E_TBTC_TRANSFER_AMOUNT=0.00001 \
ONEKEY_APP_MONOREPO_DIR=/Users/leon/Documents/onekey/app-monorepo \
  yarn cli-e2e:cli-integration:local-cli
```

Mainnet BTC swap/bridge checks remain behind `ONEKEY_CLI_E2E_ALLOW_MAINNET_SPEND=1`.
```

- [ ] **Step 9: Run cli-e2e unit tests**

```bash
cd /Users/leon/Documents/onekey/onekey-tools
yarn workspace @onekey/cli-e2e test
```

Expected: PASS.

- [ ] **Step 10: Commit in onekey-tools**

```bash
cd /Users/leon/Documents/onekey/onekey-tools
git add packages/cli-e2e/src/suites/cli-integration packages/cli-e2e/docs/runbooks/mac-mini-setup.md
git commit -m "test(cli-e2e): cover btc cli flows"
```

### Task 12: Full Verification

**Files:**
- No planned source edits.
- Verify both repositories.

- [ ] **Step 1: Run app-monorepo CLI Jest suite**

```bash
cd /Users/leon/Documents/onekey/app-monorepo
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/btc-address-types.test.ts \
  apps/cli/src/__tests__/btc-signer-hd.test.ts \
  apps/cli/src/__tests__/btc-signer-hardware.test.ts \
  apps/cli/src/__tests__/wallet-btc-address.test.ts \
  apps/cli/src/__tests__/balance-btc-derived.test.ts \
  apps/cli/src/__tests__/history-btc-derived.test.ts \
  apps/cli/src/__tests__/btc-tx-builder.test.ts \
  apps/cli/src/__tests__/transfer-btc.test.ts \
  apps/cli/src/__tests__/swap-btc-address-types.test.ts \
  apps/cli/src/__tests__/swap-execute-btc.test.ts \
  apps/cli/src/__tests__/swap-networks.test.ts \
  apps/cli/src/__tests__/token-resolver.test.ts \
  apps/cli/src/__tests__/btc-capability-gates.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing BTC read-only regression tests**

```bash
cd /Users/leon/Documents/onekey/app-monorepo
yarn jest --config apps/cli/jest.config.js --runInBand --runTestsByPath \
  apps/cli/src/__tests__/chain-resolver.test.ts \
  apps/cli/src/__tests__/address-utils.test.ts \
  apps/cli/src/__tests__/balance-btc-readonly.test.ts \
  apps/cli/src/__tests__/history-btc-readonly.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run cli-e2e unit tests**

```bash
cd /Users/leon/Documents/onekey/onekey-tools
yarn workspace @onekey/cli-e2e test
```

Expected: PASS.

- [ ] **Step 4: Run local CLI e2e safe profile**

```bash
cd /Users/leon/Documents/onekey/onekey-tools
ONEKEY_APP_MONOREPO_DIR=/Users/leon/Documents/onekey/app-monorepo \
  yarn cli-e2e:cli-integration:local-cli
```

Expected: PASS. If the resident CLI auth session is missing, the preflight section fails with instructions to run `onekey --env test auth login --app-transfer`.

- [ ] **Step 5: Inspect worktrees**

```bash
cd /Users/leon/Documents/onekey/app-monorepo
git status --short
git log --oneline -8

cd /Users/leon/Documents/onekey/onekey-tools
git status --short
git log --oneline -5
```

Expected: only intentional committed changes remain. Any untracked fixture reports under `packages/cli-e2e/reports/` are ignored or removed according to that repo's existing report policy.

## Self-Review

**Spec coverage:** Covered. Task 1 adds BTC/TBTC capabilities and address-type primitives. Tasks 2 and 3 implement HD and OneKey hardware signer support without Ledger, message-signing commands, or external PSBT commands. Tasks 4 and 5 add wallet-scoped address commands plus aggregate/per-address-type balance and history. Tasks 6 and 7 add BTC/TBTC transaction building, first receive address change, selected-address-type UTXO selection, dry-run, confirmation, and BTC txid validation. Tasks 8 through 10 add dynamic swap networks, BTC native token resolution, directional address-type flags, pending-order metadata, wallet/address revalidation, and PSBT execution. Task 11 covers `onekey-tools` cli-e2e updates, and Task 12 defines the full app-monorepo plus local CLI e2e verification loop.

**Marker scan:** Clean. Searched for the disallowed planning marker strings from the writing-plans checklist; no matches remain in implementation steps.

**Type consistency:** Consistent. The address-type values are `taproot`, `native-segwit`, `nested-segwit`, and `legacy` throughout the plan. BTC signer options use `addressType`, `relPaths`, `btcExtraInfo`, and `signOnly` consistently from the signer contract through transfer and swap execution. Swap metadata consistently uses directional source and destination address-type fields plus selected address encodings for pending-order validation.
