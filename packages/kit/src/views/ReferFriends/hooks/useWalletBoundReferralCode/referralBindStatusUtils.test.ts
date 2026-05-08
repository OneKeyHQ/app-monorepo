import {
  canBindReferralCode,
  resolveBatchWalletBindStatus,
  resolveWalletBindStatusAfterCheck,
  shouldRevalidateReferralBindStatusCache,
  shouldShowReferralBindEntry,
} from './referralBindStatusUtils';

describe('referralBindStatusUtils', () => {
  describe('canBindReferralCode', () => {
    it('returns true only for unbound bindable wallets', () => {
      expect(
        canBindReferralCode({
          isBound: false,
          bindable: true,
        }),
      ).toBe(true);

      expect(
        canBindReferralCode({
          isBound: true,
          bindable: true,
        }),
      ).toBe(false);

      expect(
        canBindReferralCode({
          isBound: false,
          bindable: false,
        }),
      ).toBe(false);
    });
  });

  describe('shouldShowReferralBindEntry', () => {
    it('requires a wallet id and a bindable state', () => {
      expect(
        shouldShowReferralBindEntry({
          walletId: 'hd-1',
          isBound: false,
          bindable: true,
        }),
      ).toBe(true);

      expect(
        shouldShowReferralBindEntry({
          walletId: 'hd-1',
          isBound: false,
          bindable: false,
        }),
      ).toBe(false);

      expect(
        shouldShowReferralBindEntry({
          walletId: '',
          isBound: false,
          bindable: true,
        }),
      ).toBe(false);
    });
  });

  describe('shouldRevalidateReferralBindStatusCache', () => {
    it('requires server revalidation for cached positive or legacy unknown states', () => {
      expect(
        shouldRevalidateReferralBindStatusCache({
          walletId: 'hd-1',
          isBound: false,
          bindable: true,
        }),
      ).toBe(true);

      expect(
        shouldRevalidateReferralBindStatusCache({
          walletId: 'hd-1',
          isBound: false,
          bindable: undefined,
        }),
      ).toBe(true);

      expect(
        shouldRevalidateReferralBindStatusCache({
          walletId: 'hd-1',
          isBound: false,
          bindable: false,
        }),
      ).toBe(false);

      expect(
        shouldRevalidateReferralBindStatusCache({
          walletId: 'hd-1',
          isBound: true,
          bindable: true,
        }),
      ).toBe(false);
    });
  });

  describe('resolveWalletBindStatusAfterCheck', () => {
    it('uses fresh server state and marks it for persistence', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          serverStatus: {
            data: false,
            bindable: false,
            reason: 'exceeded_bind_window',
          },
          isTimeout: false,
          skipIfTimeout: true,
        }),
      ).toEqual({
        source: 'server',
        shouldPersist: true,
        shouldSkip: false,
        shouldShowBindDialog: false,
        status: {
          isBound: false,
          bindable: false,
          bindWindowReason: 'exceeded_bind_window',
        },
      });
    });

    it('skips updates on timeout when timeout skipping is enabled', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          isTimeout: true,
          skipIfTimeout: true,
        }),
      ).toEqual({
        source: 'timeout',
        shouldPersist: false,
        shouldSkip: true,
        shouldShowBindDialog: false,
        status: {
          isBound: false,
          bindable: true,
          bindWindowReason: undefined,
        },
      });
    });

    it('falls back to cached state after request failure', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          cachedReferralCodeInfo: {
            walletId: 'hd-1',
            isBound: false,
            bindable: false,
            bindWindowReason: 'exceeded_bind_window',
          },
          isTimeout: false,
          skipIfTimeout: false,
        }),
      ).toEqual({
        source: 'cache',
        shouldPersist: false,
        shouldSkip: false,
        shouldShowBindDialog: false,
        status: {
          isBound: false,
          bindable: false,
          bindWindowReason: 'exceeded_bind_window',
        },
      });
    });

    it('does not show bind dialog from cached positive state after request failure', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          cachedReferralCodeInfo: {
            walletId: 'hd-1',
            isBound: false,
            bindable: true,
          },
          isTimeout: false,
          skipIfTimeout: false,
        }),
      ).toEqual({
        source: 'cache',
        shouldPersist: false,
        shouldSkip: false,
        shouldShowBindDialog: false,
        status: {
          isBound: false,
          bindable: true,
          bindWindowReason: undefined,
        },
      });
    });

    it('defaults to unbound bindable when no status is available', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          isTimeout: false,
          skipIfTimeout: false,
        }),
      ).toEqual({
        source: 'default',
        shouldPersist: false,
        shouldSkip: false,
        shouldShowBindDialog: true,
        status: {
          isBound: false,
          bindable: true,
          bindWindowReason: undefined,
        },
      });
    });

    it('treats missing bindable from server as unbound and bindable', () => {
      expect(
        resolveWalletBindStatusAfterCheck({
          serverStatus: {
            data: false,
            reason: undefined,
          },
          isTimeout: false,
          skipIfTimeout: false,
        }).status,
      ).toEqual({
        isBound: false,
        bindable: true,
        bindWindowReason: undefined,
      });
    });
  });

  describe('resolveBatchWalletBindStatus', () => {
    it('uses V2 bindable and reason directly', () => {
      expect(
        resolveBatchWalletBindStatus({
          batchStatus: {
            bound: false,
            bindable: false,
            reason: 'exceeded_bind_window',
          },
          isV1Fallback: false,
        }),
      ).toEqual({
        isBound: false,
        bindable: false,
        bindWindowReason: 'exceeded_bind_window',
      });
    });

    it('preserves cached bindable during V1 fallback', () => {
      expect(
        resolveBatchWalletBindStatus({
          batchStatus: {
            bound: false,
            bindable: true,
          },
          isV1Fallback: true,
          cachedBindable: false,
        }),
      ).toEqual({
        isBound: false,
        bindable: false,
        bindWindowReason: undefined,
      });
    });

    it('falls back to !isBound when V1 cache is empty', () => {
      expect(
        resolveBatchWalletBindStatus({
          batchStatus: {
            bound: true,
            bindable: false,
          },
          isV1Fallback: true,
        }),
      ).toEqual({
        isBound: true,
        bindable: false,
        bindWindowReason: undefined,
      });
    });
  });
});
