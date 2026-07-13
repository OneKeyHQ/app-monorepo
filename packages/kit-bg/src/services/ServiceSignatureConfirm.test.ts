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
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
// eslint-disable-next-line import-js/order, import/first
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSignatureConfirm from './ServiceSignatureConfirm';

const networkId = 'evm--56';
const accountId = 'account-id';
const accountAddress = '0xaccount';
const contractAddress = '0xcontract';

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

function buildUnsignedTx(tags: string[] = []): IUnsignedTxPro {
  return {
    encodedTx: {},
    stakingInfo: {
      protocol: 'Bitway',
      label: EEarnLabels.Stake,
      tags,
    },
  };
}

function buildService(parsedTx: IParseTransactionResp) {
  const backgroundApi = {
    serviceNetwork: {
      isCustomNetwork: jest.fn().mockResolvedValue(false),
      getVaultSettings: jest.fn().mockResolvedValue({ isUtxo: false }),
    },
  };
  const service = new ServiceSignatureConfirm({ backgroundApi });
  jest.spyOn(service, 'parseTransaction').mockResolvedValue(parsedTx);
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    buildDecodedTx: jest.fn().mockResolvedValue(buildLocalDecodedTx()),
  });
  return service;
}

describe('ServiceSignatureConfirm.buildDecodedTx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps server simulation and alerts when an unknown staking tx uses local display', async () => {
    const simulation: IDisplayComponentSimulation = {
      type: EParseTxComponentType.Simulation,
      label: 'Simulation',
      assets: [],
    };
    const alerts = ['Server risk alert'];
    const parsedTx = buildParsedTx({
      components: [
        {
          type: EParseTxComponentType.Address,
          label: 'Server contract',
          address: '0xserver-contract',
          tags: [],
        },
        simulation,
      ],
      alerts,
    });

    const decodedTx = await buildService(parsedTx).buildDecodedTx({
      networkId,
      accountId,
      accountAddress,
      unsignedTx: buildUnsignedTx(),
    });

    expect(decodedTx.isLocalParsed).toBe(true);
    expect(decodedTx.txDisplay?.components).toEqual([
      expect.objectContaining({
        type: EParseTxComponentType.Address,
        address: contractAddress,
      }),
      simulation,
    ]);
    expect(decodedTx.txDisplay?.components).not.toContainEqual(
      expect.objectContaining({ address: '0xserver-contract' }),
    );
    expect(decodedTx.txDisplay?.alerts).toEqual(alerts);
  });

  it('keeps the full server display for Borrow transactions', async () => {
    const parsedTx = buildParsedTx({
      components: [
        {
          type: EParseTxComponentType.Default,
          label: 'Server field',
          value: 'Server value',
        },
      ],
    });

    const decodedTx = await buildService(parsedTx).buildDecodedTx({
      networkId,
      accountId,
      accountAddress,
      unsignedTx: buildUnsignedTx([EEarnLabels.Borrow]),
    });

    expect(decodedTx.isLocalParsed).toBeUndefined();
    expect(decodedTx.txDisplay).toBe(parsedTx.display);
  });
});
