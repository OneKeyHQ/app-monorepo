import { notifyIntercomOpenFailed } from '@onekeyhq/shared/src/modules3rdParty/intercom/openFailure';

import { attachSupportLogs } from './supportRequest';

import type { IntlShape } from 'react-intl';

const mockOpenExpandTab = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUiPopup: true },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: async (...args: unknown[]): Promise<void> => {
        await mockOpenExpandTab(...args);
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/openFailure', () => ({
  notifyIntercomOpenFailed: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  closeExtensionPopupAfterExpandTabOpen: jest.fn(),
}));

jest.mock('./showSupportLogConsentDialog', () => ({
  showSupportLogConsentDialog: jest.fn(async () => 'upload'),
}));

jest.mock('./supportLogJobs', () => ({
  startSupportLogUpload: jest.fn(),
}));

jest.mock('../client', () => ({ showIntercom: jest.fn() }));

jest.mock('../client/identity', () => ({
  getCurrentIntercomUserId: jest.fn(async () => null),
}));

const intl = { formatMessage: () => 'logs' } as unknown as IntlShape;

describe('attachSupportLogs popup handoff', () => {
  const storage = {
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    get: jest.fn(async () => ({})),
  };

  beforeEach(() => {
    storage.set.mockReset();
    storage.set.mockResolvedValue(undefined);
    storage.remove.mockReset();
    storage.remove.mockResolvedValue(undefined);
    jest.mocked(notifyIntercomOpenFailed).mockClear();
    mockOpenExpandTab.mockReset();
    (globalThis as { chrome?: unknown }).chrome = {
      storage: { session: storage },
    };
  });

  it('hands a draft off before a conversation exists', async () => {
    mockOpenExpandTab.mockResolvedValue(undefined);

    await expect(
      attachSupportLogs({
        intl,
        ownerUserId: null,
        requestId: 'r-1',
        errorContext: {
          title: 'Signing failed',
          diagnosticText: 'RequestId: r-1',
          occurredAt: 0,
        },
      }),
    ).resolves.toBeUndefined();

    expect(storage.set).toHaveBeenCalledWith({
      onekeySupportLogHandoff: expect.objectContaining({
        requestId: 'r-1',
        errorContext: expect.objectContaining({ title: 'Signing failed' }),
      }),
    });
    expect(notifyIntercomOpenFailed).not.toHaveBeenCalled();
  });

  it('clears a stored handoff when the expanded tab does not open', async () => {
    mockOpenExpandTab.mockRejectedValue(new Error('tab failed'));

    await attachSupportLogs({ intl, ownerUserId: null });

    expect(storage.remove).toHaveBeenCalledWith('onekeySupportLogHandoff');
    expect(notifyIntercomOpenFailed).toHaveBeenCalledTimes(1);
  });
});
