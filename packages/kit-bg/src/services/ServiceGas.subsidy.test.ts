/*
yarn jest packages/kit-bg/src/services/ServiceGas.subsidy.test.ts

OK-67058: subsidy record queries go through the OneKey ID client. Prime
rejects unknown, empty or repeated query keys with 90001, so only parameters
that carry a value may be sent, and a failed query must stay silent because
the subsidy center renders its own retry state.
*/
const mockGetOneKeyIdClient: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    getOneKeyIdClient = (...args: unknown[]): Promise<unknown> =>
      mockGetOneKeyIdClient(...args);
  },
}));

jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: jest.fn() },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('../vaults/impls/fil/utils', () => ({
  FIL_MIN_BASE_FEE: '100',
}));

// eslint-disable-next-line import/first
import {
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import/first
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
// eslint-disable-next-line import/first
import { ESubsidyRecordKind } from '@onekeyhq/shared/types/subsidy';

// eslint-disable-next-line import/first
import ServiceGas from './ServiceGas';

function createService(get: jest.Mock) {
  mockGetOneKeyIdClient.mockResolvedValue({ get });
  return new ServiceGas({ backgroundApi: {} });
}

describe('ServiceGas subsidy record queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries history through the OneKey ID Prime client', async () => {
    const history = {
      contractVersion: 1,
      subjectScope: 'canonical',
      items: [],
      nextCursor: null,
      complete: true,
      sources: [],
    };
    const get = jest.fn(async () => ({ data: { code: 0, data: history } }));
    const service = createService(get);

    const result = await service.fetchSubsidyHistory({ limit: 50 });

    expect(mockGetOneKeyIdClient).toHaveBeenCalledWith(
      EServiceEndpointEnum.Prime,
    );
    expect(get).toHaveBeenCalledWith('/prime/v1/subsidy/history', {
      params: { limit: 50 },
    });
    expect(result).toBe(history);
  });

  it('drops parameters without a value instead of sending empty keys', async () => {
    const get = jest.fn(async () => ({ data: { code: 0, data: {} } }));
    const service = createService(get);

    await service.fetchSubsidyHistory({
      kind: ESubsidyRecordKind.TronEnergy,
      networkId: undefined,
      address: '',
      cursor: undefined,
    });

    expect(get).toHaveBeenCalledWith('/prime/v1/subsidy/history', {
      params: { kind: 'tron_energy' },
    });
  });

  it('jumps to a page by number', async () => {
    const get = jest.fn(async () => ({ data: { code: 0, data: {} } }));
    const service = createService(get);

    await service.fetchSubsidyHistory({ page: 3, limit: 20 });

    expect(get).toHaveBeenCalledWith('/prime/v1/subsidy/history', {
      params: { page: 3, limit: 20 },
    });
  });

  it('refuses page and cursor together before any request is sent', async () => {
    const get = jest.fn(async () => ({ data: { code: 0, data: {} } }));
    const service = createService(get);

    await expect(
      service.fetchSubsidyHistory({ page: 2, cursor: 'cursor-1' }),
    ).rejects.toMatchObject({ autoToast: false });
    expect(get).not.toHaveBeenCalled();
  });

  it('queries the summary without any parameter', async () => {
    const summary = { contractVersion: 1, subjectScope: 'canonical' };
    const get = jest.fn(async () => ({ data: { code: 0, data: summary } }));
    const service = createService(get);

    const result = await service.fetchSubsidySummary();

    expect(get).toHaveBeenCalledWith('/prime/v1/subsidy/summary', {
      params: {},
    });
    expect(result).toBe(summary);
  });

  it('silences the global toast of a failed query and keeps the error', async () => {
    const serverError = new OneKeyServerApiError({
      autoToast: true,
      message: 'summary unavailable',
      code: 90_802,
    });
    const get = jest.fn(async () => {
      throw serverError;
    });
    const service = createService(get);

    await expect(service.fetchSubsidySummary()).rejects.toBe(serverError);
    expect(serverError.autoToast).toBe(false);
    expect(serverError.code).toBe(90_802);
  });

  it('leaves a rejected session error untouched', async () => {
    const sessionError = new OneKeyErrorPrimeLoginInvalidToken({
      message: 'login required',
    });
    const autoToastBefore = sessionError.autoToast;
    const get = jest.fn(async () => {
      throw sessionError;
    });
    const service = createService(get);

    await expect(service.fetchSubsidyHistory()).rejects.toBe(sessionError);
    expect(sessionError.autoToast).toBe(autoToastBefore);
  });
});
