import { initIntercom } from '.';

import Intercom, { onShow } from '@intercom/messenger-js-sdk';

import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import { getIntercomLanguageOverride } from './utils';

jest.mock('@intercom/messenger-js-sdk', () => ({
  __esModule: true,
  default: jest.fn(),
  onShow: jest.fn(),
  show: jest.fn(),
  trackEvent: jest.fn(),
  update: jest.fn(),
}));

jest.mock('./utils', () => ({
  getCustomerJWT: jest.fn(),
  getInstanceId: jest.fn(),
  getIntercomLanguageOverride: jest.fn(),
}));

const mockIntercom = jest.mocked(Intercom);
const mockOnShow = jest.mocked(onShow);
const mockGetIntercomLanguageOverride = jest.mocked(
  getIntercomLanguageOverride,
);

describe('Intercom reset fence', () => {
  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    jest.clearAllMocks();
  });

  it('drains and aborts a pending initialization, then remains retryable after resume', async () => {
    let resolveLanguage: ((language: string) => void) | undefined;
    mockGetIntercomLanguageOverride.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveLanguage = resolve;
      }),
    );
    const pendingInit = initIntercom();
    for (
      let attempt = 0;
      attempt < 10 && mockGetIntercomLanguageOverride.mock.calls.length === 0;
      attempt += 1
    ) {
      await Promise.resolve();
    }
    expect(mockGetIntercomLanguageOverride).toHaveBeenCalledTimes(1);

    resetUtils.startResetting();
    let drainSettled = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    resolveLanguage?.('en');
    await pendingInit;
    await drain;
    expect(mockIntercom).not.toHaveBeenCalled();

    resetUtils.endResetting();
    mockGetIntercomLanguageOverride.mockResolvedValueOnce('en');
    await initIntercom();

    expect(mockIntercom).toHaveBeenCalledTimes(1);
    expect(mockOnShow).toHaveBeenCalledTimes(1);
  });
});
