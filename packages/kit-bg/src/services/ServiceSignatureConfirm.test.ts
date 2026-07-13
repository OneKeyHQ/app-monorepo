jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
    onLocaleChange: () => undefined,
  },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(),
  },
}));

// eslint-disable-next-line import-js/order, import/first
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import {
  EParseTxComponentType,
  EParseTxType,
  type IDisplayComponent,
  type IDisplayComponentSimulation,
  type IParseTransactionResp,
} from '@onekeyhq/shared/types/signatureConfirm';
// eslint-disable-next-line import-js/order, import/first
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  EApproveType,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import type { IToken } from '@onekeyhq/shared/types/token';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSignatureConfirm from './ServiceSignatureConfirm';

const networkId = 'evm--56';
const accountId = 'account-id';
const accountAddress = '0xaccount';
const contractAddress = '0xcontract';
const permit2Address = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const permit2Spender = '0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca';
const permit2Token: IToken = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  logoURI: 'https://example.com/usdc.png',
  isNative: false,
};

function buildParsedTx({
  components,
  alerts = [],
}: {
  components: IDisplayComponent[];
  alerts?: string[];
}): IParseTransactionResp {
  return {
    accountAddress,
    parsedTx: {
      to: {
        address: contractAddress,
        name: null,
        labels: null,
        isContract: true,
        riskLevel: 0,
      },
      data: {
        name: 'stake',
        args: [],
        textSignature: 'stake()',
        hexSignature: '0x12345678',
      },
    },
    display: {
      title: 'Server display',
      components,
      alerts,
    },
    type: EParseTxType.Unknown,
  };
}

function buildLocalDecodedTx(): IDecodedTx {
  return {
    txid: '',
    owner: accountAddress,
    signer: accountAddress,
    nonce: 0,
    actions: [
      {
        type: EDecodedTxActionType.UNKNOWN,
        unknownAction: {
          from: accountAddress,
          to: contractAddress,
        },
      },
    ],
    status: EDecodedTxStatus.Pending,
    networkId,
    accountId,
    extraInfo: null,
  };
}

function buildLocalPermit2DecodedTx(): IDecodedTx {
  return {
    ...buildLocalDecodedTx(),
    actions: [
      {
        type: EDecodedTxActionType.TOKEN_APPROVE,
        tokenApprove: {
          from: accountAddress,
          to: permit2Address,
          spender: permit2Spender,
          amount: '0',
          icon: permit2Token.logoURI,
          name: permit2Token.name,
          symbol: permit2Token.symbol,
          decimals: permit2Token.decimals,
          tokenIdOnNetwork: permit2Token.address,
          isInfiniteAmount: false,
          approveType: EApproveType.Approve,
        },
      },
    ],
  };
}

function buildPermit2UnsignedTx(): IUnsignedTxPro {
  return {
    encodedTx: {},
    approveInfo: {
      owner: accountAddress,
      spender: permit2Spender,
      amount: '0',
      tokenInfo: permit2Token,
      permit2Info: {
        permit2Address,
        expirationSeconds: '1785444349',
      },
    },
  };
}

function buildService(
  parsedTx: IParseTransactionResp,
  localDecodedTx = buildLocalDecodedTx(),
) {
  const backgroundApi = {
    serviceNetwork: {
      isCustomNetwork: jest.fn().mockResolvedValue(false),
      getVaultSettings: jest.fn().mockResolvedValue({ isUtxo: false }),
    },
  };
  const service = new ServiceSignatureConfirm({ backgroundApi });
  jest.spyOn(service, 'parseTransaction').mockResolvedValue(parsedTx);
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    buildDecodedTx: jest.fn().mockResolvedValue(localDecodedTx),
  });
  return service;
}

describe('ServiceSignatureConfirm.buildDecodedTx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the local Permit2 revoke display when the server Approve component is invalid', async () => {
    const simulation: IDisplayComponentSimulation = {
      type: EParseTxComponentType.Simulation,
      label: 'Simulation',
      assets: [],
    };
    const alerts = ['Server risk alert'];
    const parsedTx = buildParsedTx({
      components: [
        {
          type: EParseTxComponentType.Approve,
          label: 'Server asset',
          token: {
            info: permit2Token,
            balance: '0',
            balanceParsed: '0',
            fiatValue: '0',
            price: 0,
          },
          amountParsed: '1',
          isEditable: false,
          isInfiniteAmount: false,
          networkId,
          showNetwork: false,
          spender: permit2Address,
        },
        simulation,
      ],
      alerts,
    });

    const [decodedTx] = await buildService(
      parsedTx,
      buildLocalPermit2DecodedTx(),
    ).buildDecodedTxs({
      networkId,
      accountId,
      accountAddress,
      unsignedTxs: [buildPermit2UnsignedTx()],
    });

    expect(decodedTx.isLocalParsed).toBe(true);
    expect(decodedTx.txDisplay?.title).toBe('sig.revoke_approval_label');
    expect(decodedTx.txDisplay?.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: EParseTxComponentType.Approve,
          amountParsed: '0',
          spender: permit2Spender,
        }),
        expect.objectContaining({
          type: EParseTxComponentType.Address,
          label: 'sig.revoke_from_label',
          address: permit2Spender,
        }),
        expect.objectContaining({
          type: EParseTxComponentType.Address,
          label: 'sig.interact_contract_label',
          address: permit2Address,
        }),
        simulation,
      ]),
    );
    expect(decodedTx.txDisplay?.alerts).toEqual(alerts);
  });

  it('uses the local Permit2 display when matching server data omits address rows', async () => {
    const parsedTx = buildParsedTx({
      components: [
        {
          type: EParseTxComponentType.Approve,
          label: 'Server asset',
          token: {
            info: permit2Token,
            balance: '0',
            balanceParsed: '0',
            fiatValue: '0',
            price: 0,
          },
          amountParsed: '0',
          isEditable: false,
          isInfiniteAmount: false,
          networkId,
          showNetwork: false,
          approveType: EApproveType.Approve,
          spender: permit2Spender,
        },
      ],
    });

    const decodedTx = await buildService(
      parsedTx,
      buildLocalPermit2DecodedTx(),
    ).buildDecodedTx({
      networkId,
      accountId,
      accountAddress,
      unsignedTx: buildPermit2UnsignedTx(),
    });

    expect(decodedTx.isLocalParsed).toBe(true);
    expect(decodedTx.txDisplay?.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: EParseTxComponentType.Address,
          address: permit2Spender,
        }),
        expect.objectContaining({
          type: EParseTxComponentType.Address,
          address: permit2Address,
        }),
      ]),
    );
  });

  it('keeps a complete matching server Permit2 display', async () => {
    const parsedTx = buildParsedTx({
      components: [
        {
          type: EParseTxComponentType.Approve,
          label: 'Server asset',
          token: {
            info: permit2Token,
            balance: '0',
            balanceParsed: '0',
            fiatValue: '0',
            price: 0,
          },
          amountParsed: '0',
          isEditable: false,
          isInfiniteAmount: false,
          networkId,
          showNetwork: false,
          approveType: EApproveType.Approve,
          spender: permit2Spender,
        },
        {
          type: EParseTxComponentType.Address,
          label: 'Server spender',
          address: permit2Spender,
          tags: [],
        },
        {
          type: EParseTxComponentType.Address,
          label: 'Server interact contract',
          address: permit2Address,
          tags: [],
        },
      ],
    });

    const decodedTx = await buildService(
      parsedTx,
      buildLocalPermit2DecodedTx(),
    ).buildDecodedTx({
      networkId,
      accountId,
      accountAddress,
      unsignedTx: buildPermit2UnsignedTx(),
    });

    expect(decodedTx.isLocalParsed).toBeUndefined();
    expect(decodedTx.txDisplay).toBe(parsedTx.display);
  });
});
