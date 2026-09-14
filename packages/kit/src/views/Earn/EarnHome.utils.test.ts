import { getNextEarnPageBannerLoadStatus } from './EarnHome.utils';

describe('getNextEarnPageBannerLoadStatus', () => {
  it('stops the skeleton after an unresolved request fails', () => {
    expect(
      getNextEarnPageBannerLoadStatus({
        currentStatus: 'loading',
        event: 'requestFailed',
      }),
    ).toBe('retryableError');
  });

  it('shows the skeleton again while retrying after a failure', () => {
    expect(
      getNextEarnPageBannerLoadStatus({
        currentStatus: 'retryableError',
        event: 'requestStarted',
      }),
    ).toBe('loading');
  });

  it.each(['requestStarted', 'requestFailed'] as const)(
    'preserves a resolved layout when a refresh emits %s',
    (event) => {
      expect(
        getNextEarnPageBannerLoadStatus({
          currentStatus: 'resolved',
          event,
        }),
      ).toBe('resolved');
    },
  );

  it('resolves a successful retry', () => {
    expect(
      getNextEarnPageBannerLoadStatus({
        currentStatus: 'retryableError',
        event: 'requestResolved',
      }),
    ).toBe('resolved');
  });
});
