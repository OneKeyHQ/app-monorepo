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

jest.mock('../states/jotai/atoms/prime', () => ({
  primePersistAtom: {
    get: jest.fn(),
  },
}));

// eslint-disable-next-line import-js/order, import/first
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
import { primePersistAtom } from '../states/jotai/atoms/prime';
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

function mockActivePrimePersist() {
  (primePersistAtom.get as jest.Mock).mockResolvedValue({
    isLoggedIn: true,
    isLoggedInOnServer: true,
    primeSubscription: { isActive: true },
  });
}

function buildTransactionSecurityService(
  post: jest.Mock,
  { isCustomNetwork = false }: { isCustomNetwork?: boolean } = {},
) {
  mockActivePrimePersist();
  const backgroundApi = {
    serviceNetwork: {
      isCustomNetwork: jest.fn().mockResolvedValue(isCustomNetwork),
    },
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue(accountAddress),
    },
    serviceAccountProfile: {
      _getWalletTypeHeader: jest
        .fn()
        .mockResolvedValue({ 'X-Wallet-Type': 'hd' }),
    },
  };
  const service = new ServiceSignatureConfirm({ backgroundApi });
  Object.assign(service, {
    getClient: jest.fn().mockResolvedValue({ post }),
    getOneKeyIdAuthHeaders: jest.fn().mockResolvedValue({
      'X-Onekey-Request-Token': 'prime-token',
    }),
  });
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    buildParseTransactionParams: jest.fn(async ({ encodedTx }) => ({
      encodedTx,
    })),
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

describe('ServiceSignatureConfirm.checkTransactionSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends eth_signTypedData_v4 as jsonRpc without building an encoded tx', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          level: 'medium',
          detail: {
            code: 'permit_risk',
            features: [],
          },
        },
      },
    });
    const service = buildTransactionSecurityService(post);
    const jsonRpc = {
      method: 'eth_signTypedData_v4',
      params: ['0xsigner', '{"primaryType":"Permit"}'],
    };

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc,
      }),
    ).resolves.toEqual({
      level: 'medium',
      detail: {
        code: 'permit_risk',
        features: [],
      },
    });
    expect(post).toHaveBeenCalledWith(
      '/utility/v1/transaction/check',
      {
        networkId,
        accountAddress,
        jsonRpc,
      },
      {
        timeout: 5000,
        headers: {
          'X-Wallet-Type': 'hd',
          'X-Onekey-Request-Token': 'prime-token',
        },
      },
    );
    expect(vaultFactory.getVault).not.toHaveBeenCalled();
  });

  it('sends vault-normalized encodedTx and always attaches the Prime token', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          level: 'security',
          detail: {
            code: 'no_issues_detected',
            features: [],
          },
        },
      },
    });
    const service = buildTransactionSecurityService(post);
    const encodedTxToCheck = {
      to: '0x1',
      data: '0x',
      value: '0x0',
    };
    (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
      buildParseTransactionParams: jest.fn(async () => ({
        encodedTx: encodedTxToCheck,
      })),
    });

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        encodedTx: {
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x5208',
        } as IEncodedTx,
      }),
    ).resolves.toEqual({
      level: 'security',
      detail: {
        code: 'no_issues_detected',
        features: [],
      },
    });
    expect(post).toHaveBeenCalledWith(
      '/utility/v1/transaction/check',
      {
        networkId,
        accountAddress,
        encodedTx: encodedTxToCheck,
      },
      {
        timeout: 5000,
        headers: {
          'X-Wallet-Type': 'hd',
          'X-Onekey-Request-Token': 'prime-token',
        },
      },
    );
  });

  it('reports unavailable without calling the server when Prime is not active locally', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);
    (primePersistAtom.get as jest.Mock).mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      primeSubscription: { isActive: false },
    });

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc: {
          method: 'personal_sign',
          params: ['0xmessage', accountAddress],
        },
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'check_unavailable',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
    expect(service.getOneKeyIdAuthHeaders).not.toHaveBeenCalled();
  });

  it('returns check_failed when reading the Prime token throws', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);
    (service.getOneKeyIdAuthHeaders as jest.Mock).mockRejectedValue(
      new Error('session missing'),
    );

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc: {
          method: 'personal_sign',
          params: ['0xmessage', accountAddress],
        },
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'check_failed',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not call the server for a custom network', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post, {
      isCustomNetwork: true,
    });

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc: {
          method: 'personal_sign',
          params: ['0xmessage', accountAddress],
        },
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'network_not_supported',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ['downstream error 30401', 30_401, 'check_failed'],
    ['Prime entitlement error 31403', 31_403, 'check_unavailable'],
    ['unsupported network error 31501', 31_501, 'network_not_supported'],
  ])('maps %s', async (_name, serverCode, expectedCode) => {
    const service = buildTransactionSecurityService(
      jest.fn().mockRejectedValue({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: serverCode,
      }),
    );

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc: {
          method: 'personal_sign',
          params: ['0xmessage', accountAddress],
        },
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: { code: expectedCode, features: [] },
    });
  });

  it('returns check_failed when Prime has no request token', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);
    (service.getOneKeyIdAuthHeaders as jest.Mock).mockResolvedValue({});

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        jsonRpc: {
          method: 'personal_sign',
          params: ['0xmessage', accountAddress],
        },
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'check_failed',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('returns check_failed when request setup throws before the scan', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);
    (vaultFactory.getVault as unknown as jest.Mock).mockRejectedValue(
      new Error('no vault'),
    );

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        encodedTx: {
          to: '0x1',
          data: '0x',
          value: '0x0',
        } as IEncodedTx,
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'check_failed',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not call the server for a jsonRpc method the live schema rejects', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);

    await expect(
      service.checkTransactionSecurity({
        networkId: 'sol--101',
        accountId,
        jsonRpc: {
          method: 'solana_signTransaction',
          params: ['payload'],
        },
      }),
    ).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it('does not call the server for a native encodedTx the live schema rejects', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);

    await expect(
      service.checkTransactionSecurity({
        networkId: 'tron--0x2b6653dc',
        accountId,
        encodedTx: {
          visible: true,
          raw_data: { contract: [] },
        } as IEncodedTx,
      }),
    ).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it('returns unable_to_assess when an attemptable payload is still unsubmittable after normalize', async () => {
    const post = jest.fn();
    const service = buildTransactionSecurityService(post);
    (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
      buildParseTransactionParams: jest.fn(async ({ encodedTx }) => ({
        encodedTx,
      })),
    });

    await expect(
      service.checkTransactionSecurity({
        networkId,
        accountId,
        encodedTx: {
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x5208',
        } as IEncodedTx,
      }),
    ).resolves.toEqual({
      level: 'unknown',
      detail: {
        code: 'unable_to_assess',
        features: [],
      },
    });
    expect(post).not.toHaveBeenCalled();
  });
});
