import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import { STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';
// eslint-disable-next-line import/first
import { sumResourceBounds } from './utils';
// eslint-disable-next-line import/first
import StarknetVault from './Vault';

// eslint-disable-next-line import/first
import type { IStarknetBroadcastTx } from './sdkStarknet';
// eslint-disable-next-line import/first
import type { ITransferInfo } from '../../types';

// captured from a live Sepolia starknet_estimateFee (spec 0.9.0)
const DEPLOY_ESTIMATE = {
  l1_gas_consumed: '0x0',
  l1_gas_price: '0xa0a84ea20386',
  l2_gas_consumed: '0x2199a8',
  l2_gas_price: '0x73c72e3b3',
  l1_data_gas_consumed: '0x1c0',
  l1_data_gas_price: '0xa6f6ce2211',
  overall_fee: '0xf446df984a0638',
  unit: 'FRI',
};
const INVOKE_ESTIMATE = {
  l1_gas_consumed: '0x0',
  l1_gas_price: '0xa0a84ea20386',
  l2_gas_consumed: '0x122b53',
  l2_gas_price: '0x73c72e3b3',
  l1_data_gas_consumed: '0x80',
  l1_data_gas_price: '0xa6f6ce2211',
  overall_fee: '0x83cd0f4f25ec89',
  unit: 'FRI',
};

const PUBLIC_KEY =
  '0x4c339f18b9d1b95b64a6d378abd1480b2e0d5d5bd33cd0828cbce4d65c27284';
// default derive type, so the Argent account
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const ACCOUNT_ADDRESS = sdkStarknet.getAddressFromStarkPublicKey(
  PUBLIC_KEY,
  'argent',
);
const RECIPIENT =
  '0x077dfdc45ba4695eac4c961f3d9bf820ed7e925a44d9963de7b7a0daf8768af0';

const NETWORK = {
  id: 'starknet--sepolia',
  chainId: '0x534e5f5345504f4c4941',
  decimals: 18,
  symbol: 'STRK',
  shortname: 'TSTRK',
  logoURI: '',
  feeMeta: { decimals: 18, symbol: 'STRK' },
};

function buildTransferInfo(): ITransferInfo {
  return {
    from: ACCOUNT_ADDRESS,
    to: RECIPIENT,
    amount: '1.5',
    tokenInfo: {
      address: STRK_TOKEN_ADDRESS,
      decimals: 18,
      symbol: 'STRK',
      name: 'Starknet Token',
      isNative: true,
      logoURI: '',
    },
  };
}

function buildVault({
  isAccountDeployed,
  nonce = '0x7',
}: {
  isAccountDeployed: boolean;
  nonce?: string;
}) {
  const estimateFee = jest.fn(
    async (transactions: IStarknetBroadcastTx[], _blockId?: unknown) =>
      transactions.length === 2
        ? [DEPLOY_ESTIMATE, INVOKE_ESTIMATE]
        : [INVOKE_ESTIMATE],
  );
  const client = {
    isAccountDeployed: jest.fn(async () => isAccountDeployed),
    getNonce: jest.fn(async () => nonce),
    estimateFee,
  };

  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  Object.assign(vault, {
    accountId: ACCOUNT_ID,
    getNetwork: async () => NETWORK,
    getClient: async () => client,
    getAccount: async () => ({ address: ACCOUNT_ADDRESS, pub: PUBLIC_KEY }),
  });
  return { vault, client, estimateFee };
}

it('builds a private transfer through the standard vault entry and preserves its proof when updating fees', async () => {
  const { vault } = buildVault({ isAccountDeployed: true });
  const encodedTx = { calls: [], privacy: { kind: 'transfer' } };
  const buildPrivateTransferTx = jest.fn(async () => ({
    unsignedTx: { encodedTx },
    warnings: [],
  }));
  Object.assign(vault, {
    networkId: NETWORK.id,
    backgroundApi: { serviceStarknetPrivacy: { buildPrivateTransferTx } },
  });
  const transfer: ITransferInfo = {
    ...buildTransferInfo(),
    starknetPrivacyKind: 'transfer',
  };
  const unsignedTx = await vault.buildUnsignedTx({ transfersInfo: [transfer] });
  expect(buildPrivateTransferTx).toHaveBeenCalledWith({
    accountId: ACCOUNT_ID,
    networkId: NETWORK.id,
    kind: 'transfer',
    tokenAddress: STRK_TOKEN_ADDRESS,
    amount: '1500000000000000000',
    recipient: RECIPIENT,
  });
  await expect(
    vault.buildUnsignedTx({
      encodedTx: await vault.buildEncodedTx({
        transfersInfo: [buildTransferInfo()],
      }),
      transfersInfo: [transfer],
    }),
  ).rejects.toMatchObject({
    key: ETranslations.feedback_failed_to_parse_transaction,
  });
  expect(unsignedTx.encodedTx).toBe(encodedTx);
  const updated = await vault.updateUnsignedTx({
    unsignedTx,
    nativeAmountInfo: { amount: '2' },
  });
  expect(updated.encodedTx).toMatchObject({
    privacy: { kind: 'transfer' },
    calls: [],
  });
});

describe('StarknetVault.buildEncodedTx deploy branch', () => {
  it('rejects an amount smaller than the token precision without rounding', async () => {
    const { vault, estimateFee } = buildVault({ isAccountDeployed: true });
    const info = buildTransferInfo();
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [
          {
            ...info,
            amount: '0.0000016',
            tokenInfo: { ...info.tokenInfo!, decimals: 6 },
          },
        ],
      }),
    ).rejects.toThrow();
    expect(estimateFee).not.toHaveBeenCalled();
  });

  it('omits deployAccount and takes the nonce from the node when deployed', async () => {
    const { vault, client, estimateFee } = buildVault({
      isAccountDeployed: true,
      nonce: '0x7',
    });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [buildTransferInfo()],
    });

    expect(encodedTx.deployAccount).toBeUndefined();
    expect(encodedTx.nonce).toBe('0x7');
    expect(client.getNonce).toHaveBeenCalledWith(ACCOUNT_ADDRESS);
    // one leg only
    expect(estimateFee.mock.calls[0][0]).toHaveLength(1);
    expect(estimateFee.mock.calls[0][0][0].type).toBe('INVOKE');
  });

  it('attaches deployAccount and shifts the invoke to nonce 1 when undeployed', async () => {
    const { vault, client, estimateFee } = buildVault({
      isAccountDeployed: false,
    });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [buildTransferInfo()],
    });

    expect(encodedTx.nonce).toBe('0x1');
    expect(encodedTx.deployAccount).toBeDefined();
    expect(encodedTx.deployAccount?.nonce).toBe('0x0');
    expect(encodedTx.deployAccount?.classHash).toBe(
      sdkStarknet.ARGENT_ACCOUNT_CLASS_HASH,
    );
    expect(encodedTx.deployAccount?.addressSalt).toBe(PUBLIC_KEY);
    // the node is never asked for a nonce that cannot exist yet
    expect(client.getNonce).not.toHaveBeenCalled();
    // both legs travel in one estimate call, deploy first
    const estimated = estimateFee.mock.calls[0][0];
    expect(estimated).toHaveLength(2);
    expect(estimated[0].type).toBe('DEPLOY_ACCOUNT');
    expect(estimated[1].type).toBe('INVOKE');
  });

  it('deploys the OpenZeppelin account for the suffixed derive type', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    const ozAddress = sdkStarknet.getAddressFromStarkPublicKey(
      PUBLIC_KEY,
      'openZeppelin',
    );
    Object.assign(vault, {
      accountId: `${ACCOUNT_ID}--${EAddressEncodings.STARKNET_OZ}`,
      getAccount: async () => ({ address: ozAddress, pub: PUBLIC_KEY }),
    });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [{ ...buildTransferInfo(), from: ozAddress }],
    });
    expect(encodedTx.deployAccount?.classHash).toBe(
      sdkStarknet.OPENZEPPELIN_ACCOUNT_CLASS_HASH,
    );
    expect(encodedTx.deployAccount?.constructorCalldata).toEqual([PUBLIC_KEY]);
  });

  it('deploys the OKX account for the suffixed derive type', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    const okxAddress = sdkStarknet.getAddressFromStarkPublicKey(
      PUBLIC_KEY,
      'okx',
    );
    Object.assign(vault, {
      accountId: `${ACCOUNT_ID}--${EAddressEncodings.STARKNET_OKX}`,
      getAccount: async () => ({ address: okxAddress, pub: PUBLIC_KEY }),
    });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [{ ...buildTransferInfo(), from: okxAddress }],
    });
    expect(encodedTx.deployAccount?.classHash).toBe(
      sdkStarknet.OKX_PROXY_CLASS_HASH,
    );
    expect(encodedTx.deployAccount?.constructorCalldata).toEqual(
      sdkStarknet.getAccountDeployParams(PUBLIC_KEY, 'okx').constructorCalldata,
    );
  });

  it('refuses to deploy an Argent account stored with an OpenZeppelin address', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    const ozAddress = sdkStarknet.getAddressFromStarkPublicKey(
      PUBLIC_KEY,
      'openZeppelin',
    );
    Object.assign(vault, {
      getAccount: async () => ({ address: ozAddress, pub: PUBLIC_KEY }),
    });

    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ ...buildTransferInfo(), from: ozAddress }],
      }),
    ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
  });

  it('re-detects deployment on every call rather than caching it', async () => {
    const { vault, client } = buildVault({ isAccountDeployed: true });

    await vault.buildEncodedTx({ transfersInfo: [buildTransferInfo()] });
    await vault.buildEncodedTx({ transfersInfo: [buildTransferInfo()] });

    expect(client.isAccountDeployed).toHaveBeenCalledTimes(2);
  });

  it('prices both legs with padded bounds', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [buildTransferInfo()],
    });

    // 0x122b53 * 1.5 floored
    expect(encodedTx.resourceBounds.l2_gas.max_amount).toBe('0x1b40fc');
    // 0x2199a8 * 1.5 floored
    expect(encodedTx.deployAccount?.resourceBounds.l2_gas.max_amount).toBe(
      '0x32667c',
    );
    expect(sumResourceBounds(encodedTx.resourceBounds)).not.toBe('0');
    expect(
      sumResourceBounds(
        encodedTx.deployAccount?.resourceBounds ?? {
          l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
          l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
          l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
        },
      ),
    ).not.toBe('0');
  });

  it('builds a single ERC-20 transfer call in base units', async () => {
    const { vault } = buildVault({ isAccountDeployed: true });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [buildTransferInfo()],
    });

    expect(encodedTx.calls).toHaveLength(1);
    expect(encodedTx.calls[0]).toEqual({
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: 'transfer',
      // 1.5 STRK = 1500000000000000000 = 0x14d1120d7b160000
      calldata: [RECIPIENT, '0x14d1120d7b160000', '0x0'],
    });
    expect(encodedTx.version).toBe('0x3');
    expect(encodedTx.chainId).toBe(NETWORK.chainId);
    expect(encodedTx.from).toBe(ACCOUNT_ADDRESS);
  });

  it('refuses to deploy when the stored address is not the counterfactual one', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    Object.assign(vault, {
      getAccount: async () => ({
        address: ACCOUNT_ADDRESS,
        pub: '0x1234',
      }),
    });

    await expect(
      vault.buildEncodedTx({ transfersInfo: [buildTransferInfo()] }),
    ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
  });

  it('rejects batch transfers', async () => {
    const { vault } = buildVault({ isAccountDeployed: true });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [buildTransferInfo(), buildTransferInfo()],
      }),
    ).rejects.toMatchObject({ key: ETranslations.send_engine_not_implemented });
  });
});

// RPC spec FELT: 0x-hex, no leading zeros. The app stores addresses zero-padded
// and starknet.js emits decimal calldata, so both have to be re-encoded before
// anything reaches the wire.
const FELT_RE = /^0x(0|[a-fA-F1-9][a-fA-F0-9]{0,62})$/;

function collectFelts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') {
    // the availability-mode fields are enums, not felts
    return value === 'L1' || value === 'INVOKE' || value === 'DEPLOY_ACCOUNT'
      ? []
      : [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectFelts(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      collectFelts(v, `${path}.${k}`),
    );
  }
  return [];
}

describe('StarknetVault estimate payloads are spec-valid felts', () => {
  it.each([true, false])(
    'emits no decimal or zero-padded felt (deployed=%s)',
    async (isAccountDeployed) => {
      const { vault, estimateFee } = buildVault({ isAccountDeployed });
      await vault.buildEncodedTx({ transfersInfo: [buildTransferInfo()] });

      const sent = estimateFee.mock.calls[0][0];
      const felts = collectFelts(sent, 'tx');
      expect(felts.length).toBeGreaterThan(10);
      const bad = felts.filter(([, v]) => !FELT_RE.test(v));
      expect(bad).toEqual([]);
    },
  );

  it('re-encodes the zero-padded sender address', async () => {
    const { vault, estimateFee } = buildVault({ isAccountDeployed: true });
    await vault.buildEncodedTx({ transfersInfo: [buildTransferInfo()] });

    const [invoke] = estimateFee.mock.calls[0][0];
    expect(invoke.type).toBe('INVOKE');
    const senderAddress = invoke.type === 'INVOKE' ? invoke.sender_address : '';

    expect(ACCOUNT_ADDRESS).toMatch(/^0x0/);
    expect(senderAddress).not.toMatch(/^0x0[0-9a-f]/);
    expect(BigInt(senderAddress)).toBe(BigInt(ACCOUNT_ADDRESS));
  });
});

describe('standalone account activation', () => {
  it('estimates and prepares only DEPLOY_ACCOUNT before privacy authorization', async () => {
    const { vault, estimateFee } = buildVault({ isAccountDeployed: false });
    const unsignedTx = await vault.buildAccountActivationTx();
    expect(unsignedTx?.encodedTx).toMatchObject({
      type: 'DEPLOY_ACCOUNT',
      nonce: '0x0',
      calls: [],
    });
    const legs = estimateFee.mock.calls[0][0];
    expect(legs).toHaveLength(1);
    expect(legs[0].type).toBe('DEPLOY_ACCOUNT');
    expect(estimateFee.mock.calls[0][1]).toBe('latest');
  });

  it('resolves address encoding suffix for imported OZ and OKX accounts', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    vault.accountId = `imported--9004--0xpubkey--${EAddressEncodings.STARKNET_OZ}`;
    await expect(vault.getAddressEncoding()).resolves.toBe(
      EAddressEncodings.STARKNET_OZ,
    );
    vault.accountId = `imported--9004--0xpubkey--${EAddressEncodings.STARKNET_OKX}`;
    await expect(vault.getAddressEncoding()).resolves.toBe(
      EAddressEncodings.STARKNET_OKX,
    );
    vault.accountId = 'imported--9004--0xpubkey';
    await expect(vault.getAddressEncoding()).resolves.toBeUndefined();
  });

  it('does not prepare another activation once the account exists', async () => {
    const { vault, estimateFee } = buildVault({ isAccountDeployed: true });
    await expect(vault.buildAccountActivationTx()).resolves.toBeUndefined();
    expect(estimateFee).not.toHaveBeenCalled();
  });

  it('uses only the parsed account suffix for account type selection', async () => {
    const { vault } = buildVault({ isAccountDeployed: false });
    Object.assign(vault, {
      accountId: `hd-1--pathEndingIn${EAddressEncodings.STARKNET_OZ}`,
    });
    await expect(vault.getAddressEncoding()).resolves.toBeUndefined();
  });
});
