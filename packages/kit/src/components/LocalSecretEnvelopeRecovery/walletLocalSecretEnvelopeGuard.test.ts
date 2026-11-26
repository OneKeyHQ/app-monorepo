/** @jest-environment jsdom */

import { walletLocalSecretEnvelopeStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/walletLocalSecretEnvelopeStatus';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { getLocalSecretEnvelopeCredentialKey } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  blockIfWalletLocalSecretEnvelopeUnavailable,
  clearWalletLocalSecretEnvelopeConfirmedReadableCache,
  getWalletLocalSecretEnvelopeCredentialId,
} from './walletLocalSecretEnvelopeGuard';

const mockPreflight = jest.fn<
  Promise<ILocalSecretEnvelopeCredentialIssue | null | undefined>,
  [{ credentialId: string; expiresAt: number }]
>();

const appStateListeners: ((state: string) => void)[] = [];

jest.mock(
  '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData')
    >('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData'),
    getLocalSecretEnvelopeCredentialKey: (sessionId: string, id: string) =>
      `${sessionId}:${id}`,
  }),
);

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (s: string) => void) => {
      appStateListeners.push(listener);
      return { remove: jest.fn() };
    },
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      preflightWalletLocalSecretEnvelope: (params: {
        credentialId: string;
        expiresAt: number;
      }) => mockPreflight(params),
    },
  },
}));

const SESSION_ID = 'test-lse-session';

function setLseIssues(
  issues: Record<string, ILocalSecretEnvelopeCredentialIssue>,
  sessionId = SESSION_ID,
) {
  jotaiDefaultStore.set(walletLocalSecretEnvelopeStatusAtom.atom(), {
    sessionId,
    issues,
  });
}

describe('walletLocalSecretEnvelopeGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWalletLocalSecretEnvelopeConfirmedReadableCache();
    setLseIssues({}, '');
  });

  describe('getWalletLocalSecretEnvelopeCredentialId', () => {
    it('resolves HD wallet id and imported account id', () => {
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'hd-1',
          accountId: "hd-1--m/44'/60'/0'/0/0",
        }),
      ).toBe('hd-1');
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          accountId: "hd-2--m/44'/60'/0'/0/0",
        }),
      ).toBe('hd-2');
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'imported',
          accountId: 'imported--60--0xabc',
        }),
      ).toBe('imported--60--0xabc');
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          accountId: 'imported--60--0xabc',
        }),
      ).toBe('imported--60--0xabc');
    });

    it('returns undefined for non-LSE wallets', () => {
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'hw-1',
          accountId: "hw-1--m/44'/60'/0'/0/0",
        }),
      ).toBeUndefined();
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'qr-1',
          accountId: "qr-1--m/44'/60'/0'/0/0",
        }),
      ).toBeUndefined();
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'watching',
          accountId: 'watching--60--0xabc',
        }),
      ).toBeUndefined();
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'external',
          accountId: 'external--60--0xabc',
        }),
      ).toBeUndefined();
      expect(
        getWalletLocalSecretEnvelopeCredentialId({
          walletId: 'imported',
        }),
      ).toBeUndefined();
    });
  });

  describe('blockIfWalletLocalSecretEnvelopeUnavailable', () => {
    it('blocks immediately and opens the recovery dialog when status atom has an HD issue', async () => {
      const credentialKey = getLocalSecretEnvelopeCredentialKey(
        SESSION_ID,
        'hd-1',
      );
      const issue: ILocalSecretEnvelopeCredentialIssue = {
        credentialKey,
        reason: 'key-missing',
      };
      setLseIssues({ [credentialKey]: issue });

      const onShowDialog = jest.fn();
      appEventBus.on(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        onShowDialog,
      );
      try {
        const blocked = await blockIfWalletLocalSecretEnvelopeUnavailable({
          walletId: 'hd-1',
          accountId: "hd-1--m/44'/60'/0'/0/0",
        });
        expect(blocked).toBe(true);
        expect(onShowDialog).toHaveBeenCalledWith(issue);
        expect(mockPreflight).not.toHaveBeenCalled();
      } finally {
        appEventBus.off(
          EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
          onShowDialog,
        );
      }
    });

    it('blocks only the affected imported account', async () => {
      const affectedAccountId = 'imported--60--0xabc';
      const unaffectedAccountId = 'imported--60--0xdef';
      const credentialKey = getLocalSecretEnvelopeCredentialKey(
        SESSION_ID,
        affectedAccountId,
      );
      const issue: ILocalSecretEnvelopeCredentialIssue = {
        credentialKey,
        reason: 'authentication-failed',
        imported: true,
      };
      setLseIssues({ [credentialKey]: issue });
      mockPreflight.mockResolvedValue(null);

      const onShowDialog = jest.fn();
      appEventBus.on(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        onShowDialog,
      );
      try {
        expect(
          await blockIfWalletLocalSecretEnvelopeUnavailable({
            walletId: 'imported',
            accountId: affectedAccountId,
          }),
        ).toBe(true);
        expect(onShowDialog).toHaveBeenCalledTimes(1);
        expect(onShowDialog).toHaveBeenCalledWith(issue);

        expect(
          await blockIfWalletLocalSecretEnvelopeUnavailable({
            walletId: 'imported',
            accountId: unaffectedAccountId,
          }),
        ).toBe(false);
        expect(onShowDialog).toHaveBeenCalledTimes(1);
      } finally {
        appEventBus.off(
          EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
          onShowDialog,
        );
      }
    });

    it('runs on-demand preflight when status is not cached and blocks on detected issue', async () => {
      const issue: ILocalSecretEnvelopeCredentialIssue = {
        credentialKey: 'detected-key',
        reason: 'key-missing',
      };
      mockPreflight.mockResolvedValueOnce(issue);

      const onShowDialog = jest.fn();
      appEventBus.on(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        onShowDialog,
      );
      try {
        const presentDialog = jest.fn(async (show: () => void) => {
          show();
        });
        const blocked = await blockIfWalletLocalSecretEnvelopeUnavailable({
          walletId: 'hd-9',
          presentDialog,
        });
        expect(blocked).toBe(true);
        expect(mockPreflight).toHaveBeenCalledWith(
          expect.objectContaining({ credentialId: 'hd-9' }),
        );
        expect(presentDialog).toHaveBeenCalledTimes(1);
        expect(onShowDialog).toHaveBeenCalledWith(issue);
      } finally {
        appEventBus.off(
          EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
          onShowDialog,
        );
      }
    });

    it('caches confirmed readable credentials and invalidates on key change or backgrounding', async () => {
      mockPreflight.mockResolvedValue(null);

      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-3' }),
      ).toBe(false);
      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-3' }),
      ).toBe(false);
      expect(mockPreflight).toHaveBeenCalledTimes(1);

      appEventBus.emit(
        EAppEventBusNames.WalletLocalSecretEnvelopeKeysChanged,
        undefined,
      );
      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-3' }),
      ).toBe(false);
      expect(mockPreflight).toHaveBeenCalledTimes(2);

      // Backgrounding also invalidates the readable cache.
      expect(appStateListeners.length).toBeGreaterThan(0);
      appStateListeners.forEach((listener) => listener('background'));
      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-3' }),
      ).toBe(false);
      expect(mockPreflight).toHaveBeenCalledTimes(3);
    });

    it('does not block hardware wallets or inconclusive preflight results', async () => {
      mockPreflight.mockRejectedValueOnce(new Error('bg unavailable'));

      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({
          walletId: 'hw-1',
          accountId: "hw-1--m/44'/60'/0'/0/0",
        }),
      ).toBe(false);
      expect(mockPreflight).not.toHaveBeenCalled();

      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-4' }),
      ).toBe(false);
      expect(mockPreflight).toHaveBeenCalledTimes(1);
    });

    it('re-verifies Android authentication-failed issues so healed warmup unblocks while persistent failures stay blocked', async () => {
      const credentialKey = getLocalSecretEnvelopeCredentialKey(
        SESSION_ID,
        'hd-5',
      );
      const issue: ILocalSecretEnvelopeCredentialIssue = {
        credentialKey,
        reason: 'authentication-failed',
      };
      setLseIssues({ [credentialKey]: issue });

      const androidEnv = jest.replaceProperty(
        platformEnv,
        'isNativeAndroid',
        true,
      );
      const onShowDialog = jest.fn();
      appEventBus.on(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        onShowDialog,
      );
      try {
        // Still unreadable or inconclusive -> stays blocked.
        mockPreflight.mockResolvedValueOnce(undefined);
        expect(
          await blockIfWalletLocalSecretEnvelopeUnavailable({
            walletId: 'hd-5',
          }),
        ).toBe(true);
        expect(onShowDialog).toHaveBeenCalledWith(issue);

        // KeyStore warmed up and credential decrypted -> self-heals and unblocks.
        mockPreflight.mockResolvedValueOnce(null);
        expect(
          await blockIfWalletLocalSecretEnvelopeUnavailable({
            walletId: 'hd-5',
          }),
        ).toBe(false);
        expect(mockPreflight).toHaveBeenCalledTimes(2);
      } finally {
        androidEnv.restore();
        appEventBus.off(
          EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
          onShowDialog,
        );
      }
    });

    it('does not repopulate readable cache when invalidated while preflight is in flight', async () => {
      let resolvePreflight!: (
        value: ILocalSecretEnvelopeCredentialIssue | null | undefined,
      ) => void;
      mockPreflight.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePreflight = resolve;
          }),
      );

      const pending = blockIfWalletLocalSecretEnvelopeUnavailable({
        walletId: 'hd-6',
      });
      // Invalidate cache while preflight is still pending.
      appEventBus.emit(
        EAppEventBusNames.WalletLocalSecretEnvelopeKeysChanged,
        undefined,
      );
      resolvePreflight(null);
      expect(await pending).toBe(false);

      // Next call must re-run preflight instead of trusting the stale null result.
      mockPreflight.mockResolvedValueOnce(null);
      expect(
        await blockIfWalletLocalSecretEnvelopeUnavailable({ walletId: 'hd-6' }),
      ).toBe(false);
      expect(mockPreflight).toHaveBeenCalledTimes(2);
    });

    it('bounds on-demand preflight wait by timeout and treats stalls as inconclusive', async () => {
      jest.useFakeTimers();
      try {
        mockPreflight.mockImplementationOnce(
          () => new Promise(() => undefined),
        );
        const pending = blockIfWalletLocalSecretEnvelopeUnavailable({
          walletId: 'hd-7',
        });
        jest.advanceTimersByTime(1500);
        await expect(pending).resolves.toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
