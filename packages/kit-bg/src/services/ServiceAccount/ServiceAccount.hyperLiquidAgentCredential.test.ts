/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getCredentialSafe: jest.fn(),
    getHyperLiquidAgentCredential: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import ServiceAccount from './ServiceAccount';

const localDbMock = (
  jest.requireMock('../../dbs/local/localDb') as {
    default: {
      getCredentialSafe: jest.MockedFunction<
        (credentialId: string) => Promise<unknown>
      >;
      getHyperLiquidAgentCredential: jest.MockedFunction<
        (params: {
          userAddress: string;
          agentName: EHyperLiquidAgentName;
        }) => Promise<ICoreHyperLiquidAgentCredential | undefined>
      >;
    };
  }
).default;

const mockGetCredentialSafe = localDbMock.getCredentialSafe;
const mockGetHyperLiquidAgentCredential =
  localDbMock.getHyperLiquidAgentCredential;

const mockAppErrorLog = (
  jest.requireMock('@onekeyhq/shared/src/logger/logger') as {
    defaultLogger: {
      app: { error: { log: jest.MockedFunction<(msg: string) => void> } };
    };
  }
).defaultLogger.app.error.log;

const credential: ICoreHyperLiquidAgentCredential = {
  userAddress: '0x1111111111111111111111111111111111111111',
  agentName: EHyperLiquidAgentName.OneKeyAgent1,
  privateKey:
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  agentAddress: '0x2222222222222222222222222222222222222222',
  validUntil: 1_900_000_000_000,
};

describe('ServiceAccount HyperLiquid agent credential upsert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rethrows an add failure when no existing credential can be found', async () => {
    const service = new ServiceAccount({ backgroundApi: {} as never });
    const addError = new Error('LSE write failed');
    jest
      .spyOn(service, 'addHyperLiquidAgentCredential')
      .mockRejectedValue(addError);
    const update = jest
      .spyOn(service, 'updateHyperLiquidAgentCredential')
      .mockResolvedValue({ credentialId: 'unused' });
    mockGetCredentialSafe.mockResolvedValue(undefined);

    await expect(
      service.addOrUpdateHyperLiquidAgentCredential(credential),
    ).rejects.toBe(addError);
    expect(update).not.toHaveBeenCalled();
  });

  it('falls back to update only after confirming the credential exists', async () => {
    const service = new ServiceAccount({ backgroundApi: {} as never });
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    jest
      .spyOn(service, 'addHyperLiquidAgentCredential')
      .mockRejectedValue(new Error('record already exists'));
    const update = jest
      .spyOn(service, 'updateHyperLiquidAgentCredential')
      .mockResolvedValue({ credentialId });
    mockGetCredentialSafe.mockResolvedValue({
      id: credentialId,
      credential: 'existing-credential',
    });

    await expect(
      service.addOrUpdateHyperLiquidAgentCredential(credential),
    ).resolves.toEqual({ credentialId });
    expect(mockGetCredentialSafe).toHaveBeenCalledWith(credentialId);
    expect(update).toHaveBeenCalledWith(credential);
  });
});

describe('ServiceAccount getHyperLiquidAgentCredentialInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined instead of rejecting when the credential read throws', async () => {
    const service = new ServiceAccount({ backgroundApi: {} as never });
    mockGetHyperLiquidAgentCredential.mockRejectedValue(
      new Error(
        'HyperLiquid agent secret session is unavailable; unlock the app again',
      ),
    );

    await expect(
      service.getHyperLiquidAgentCredentialInfo({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toBeUndefined();
    expect(mockAppErrorLog).toHaveBeenCalledWith(
      'HyperLiquid agent credential info read failed',
    );
  });

  it('returns credential info without the private key when the read succeeds', async () => {
    const service = new ServiceAccount({ backgroundApi: {} as never });
    mockGetHyperLiquidAgentCredential.mockResolvedValue(credential);

    const info = await service.getHyperLiquidAgentCredentialInfo({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });

    expect(info).toEqual({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
      agentAddress: credential.agentAddress,
      validUntil: credential.validUntil,
    });
    expect(info).not.toHaveProperty('privateKey');
  });

  it('returns undefined when no credential exists', async () => {
    const service = new ServiceAccount({ backgroundApi: {} as never });
    mockGetHyperLiquidAgentCredential.mockResolvedValue(undefined);

    await expect(
      service.getHyperLiquidAgentCredentialInfo({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toBeUndefined();
    expect(mockAppErrorLog).not.toHaveBeenCalled();
  });
});
