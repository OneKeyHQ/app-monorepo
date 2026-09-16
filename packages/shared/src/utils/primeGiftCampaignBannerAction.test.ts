import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';

import { handlePrimeGiftCampaignBannerPress } from './primeGiftCampaignBannerAction';

jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  parseNotificationPayload: jest.fn(),
}));

const mockClick = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftClaimSuccessBannerClick: (...args: unknown[]) => {
          mockClick(...args);
        },
      },
    },
  },
}));

const mockedParse = parseNotificationPayload as jest.MockedFunction<
  typeof parseNotificationPayload
>;

describe('handlePrimeGiftCampaignBannerPress', () => {
  const item = {
    linkId: 'campaign-1',
    mode: 3,
    payload: 'https://onekey.so',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not log a click when navigation is not handled', () => {
    mockedParse.mockReturnValue(false);
    expect(handlePrimeGiftCampaignBannerPress(item)).toBe(false);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('logs a click only after navigation is handled', () => {
    mockedParse.mockReturnValue(true);
    expect(handlePrimeGiftCampaignBannerPress(item)).toBe(true);
    expect(mockClick).toHaveBeenCalledWith({
      slot: 'pro2_prime_claim_success',
      linkId: 'campaign-1',
    });
  });
});
