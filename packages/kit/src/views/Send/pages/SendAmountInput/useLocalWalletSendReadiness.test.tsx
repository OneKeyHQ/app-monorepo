/* eslint-disable import/first */

const mockSnapshot: {
  result?: { scope: string; readiness: ILocalWalletSendReadiness | undefined };
} = {};
let mockRequest:
  | (() => Promise<
      | { scope: string; readiness: ILocalWalletSendReadiness | undefined }
      | undefined
    >)
  | undefined;
const mockRun = jest.fn(async () => undefined);
const mockRequestSync = jest.fn<Promise<void>, [object]>(async () => undefined);
const mockPageOpened = jest.fn<Promise<void>, [object]>(async () => undefined);
const mockPrewarm = jest.fn<Promise<void>, [object]>(async () => undefined);
const mockGetReadiness = jest.fn<
  Promise<ILocalWalletSendReadiness | undefined>,
  [{ networkId: string; accountId: string; sourcePool?: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      requestLocalWalletSendSync: (params: object) => mockRequestSync(params),
      onLocalWalletPageOpened: (params: object) => mockPageOpened(params),
      prewarmLocalWalletSend: (params: object) => mockPrewarm(params),
      getLocalWalletSendReadiness: (params: {
        networkId: string;
        accountId: string;
        sourcePool?: string;
      }) => mockGetReadiness(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: typeof mockRequest) => {
    mockRequest = request;
    return { ...mockSnapshot, run: mockRun };
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { atom } = jest.requireActual<typeof import('jotai')>('jotai');
  const value = atom({ progress: {} as Record<string, object> });
  return { privacyChainAtom: { atom: () => value } };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatNumber: (value: number) => String(value),
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string | number>,
    ) => (values ? `${id}:${JSON.stringify(values)}` : id),
  }),
}));
jest.mock('@onekeyhq/kit/src/utils/privacyChainSyncDisplay', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit/src/utils/privacyChainSyncDisplay')
  >('@onekeyhq/kit/src/utils/privacyChainSyncDisplay'),
  formatPrivacyChainSyncError: (kind?: string) =>
    kind ? `sync-error:${kind}` : undefined,
}));

import { act, renderHook } from '@testing-library/react-native';
import { getDefaultStore } from 'jotai';

import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocalWalletSendReadiness } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getLocalWalletSendSyncStatusText,
  useLocalWalletSendPrewarm,
  useLocalWalletSendReadiness,
} from './useLocalWalletSendReadiness';

const intl = {
  formatNumber: (value: number) => new Intl.NumberFormat('en-US').format(value),
  formatMessage: (
    { id }: { id: string },
    values?: Record<string, string | number>,
  ) => (values ? `${id}:${JSON.stringify(values)}` : id),
} as Parameters<typeof getLocalWalletSendSyncStatusText>[0]['intl'];

const props = {
  enabled: true,
  networkId: 'zec--0',
  accountId: 'hd-1--0',
  sourcePool: 'orchard',
};
const scope = 'zec--0:hd-1--0:orchard';

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot.result = undefined;
});

describe('send sync status text', () => {
  it('says nothing once sending is allowed', () => {
    expect(
      getLocalWalletSendSyncStatusText({
        readiness: { blocksLeft: 0, canSend: true },
        intl,
      }),
    ).toBeUndefined();
    expect(
      getLocalWalletSendSyncStatusText({ readiness: undefined, intl }),
    ).toBeUndefined();
  });

  it('explains why a send is waiting', () => {
    const text = (readiness: ILocalWalletSendReadiness) =>
      getLocalWalletSendSyncStatusText({ readiness, intl });
    for (const status of ['accountPaused', 'chainPaused'] as const) {
      expect(text({ blocksLeft: 5, canSend: false, status })).toBe(
        ETranslations.syncing_paused__title,
      );
    }
    expect(text({ blocksLeft: null, canSend: false, status: 'off' })).toBe(
      ETranslations.privacy_enable__title,
    );
    expect(
      text({ blocksLeft: null, canSend: false, status: 'unavailable' }),
    ).toBe(ETranslations.global_not_available);
    for (const status of ['enabling', 'preparing'] as const) {
      expect(text({ blocksLeft: null, canSend: false, status })).toBe(
        ETranslations.global_preparing,
      );
    }
    expect(
      text({ blocksLeft: 5, canSend: false, status: 'storageUnsupported' }),
    ).toBe(ETranslations.privacy_error_webview_outdated__msg);
    expect(text({ blocksLeft: 5, canSend: false, status: 'waitingWifi' })).toBe(
      ETranslations.privacy_sync_waiting_wifi__msg,
    );
    expect(
      text({ blocksLeft: 5, canSend: false, syncError: 'nodeUnreachable' }),
    ).toBe('sync-error:nodeUnreachable');
    expect(text({ blocksLeft: 0, canSend: false })).toBe(
      ETranslations.global_syncing,
    );
    expect(text({ blocksLeft: 120, canSend: false })).toBe(
      `${ETranslations.privacy_send_waiting_sync__msg}:{"blocks":"120"}`,
    );
    expect(text({ blocksLeft: null, canSend: false })).toBe(
      ETranslations.global_syncing,
    );
    expect(text({ blocksLeft: 123_456, canSend: false })).toBe(
      `${ETranslations.privacy_send_waiting_sync__msg}:{"blocks":"123,456"}`,
    );
    expect(text({ blocksLeft: null, canSend: false, status: 'error' })).toBe(
      ETranslations.global_sync_error,
    );
  });
});

describe('useLocalWalletSendReadiness', () => {
  it('asks for a sync once per account and pool', () => {
    const { rerender } = renderHook(
      (value: typeof props) => useLocalWalletSendReadiness(value),
      { initialProps: props },
    );
    rerender({ ...props });
    expect(mockRequestSync).toHaveBeenCalledTimes(1);
    expect(mockRequestSync).toHaveBeenCalledWith({
      networkId: props.networkId,
      accountId: props.accountId,
      sourcePool: 'orchard',
    });
    rerender({ ...props, sourcePool: 'ironwood' });
    expect(mockRequestSync).toHaveBeenCalledTimes(2);
  });

  // Not only a pool with a send sync: every privacy send wants the chain caught up now.
  it('wakes the scan as the page opens', () => {
    mockPageOpened.mockClear();
    renderHook(() => useLocalWalletSendReadiness(props));
    expect(mockPageOpened).toHaveBeenCalledWith({
      networkId: props.networkId,
    });
  });

  it('waits until this account and pool have an answer, then follows it', () => {
    const { result, rerender } = renderHook(
      (value: typeof props) => useLocalWalletSendReadiness(value),
      { initialProps: props },
    );
    expect(result.current.isWaitingForSync).toBe(true);
    expect(result.current.statusText).toBeUndefined();

    mockSnapshot.result = {
      scope,
      readiness: { blocksLeft: 3, canSend: false },
    };
    rerender({ ...props });
    expect(result.current.isWaitingForSync).toBe(true);
    expect(result.current.statusText).toBe(
      `${ETranslations.privacy_send_waiting_sync__msg}:{"blocks":"3"}`,
    );

    mockSnapshot.result = { scope, readiness: undefined };
    rerender({ ...props });
    expect(result.current.isWaitingForSync).toBe(false);

    // Another pool's answer does not carry over.
    rerender({ ...props, sourcePool: 'ironwood' });
    expect(result.current.isWaitingForSync).toBe(true);
  });

  it('never gates when disabled', () => {
    const { result } = renderHook(() =>
      useLocalWalletSendReadiness({ ...props, enabled: false }),
    );
    expect(result.current.isWaitingForSync).toBe(false);
    expect(mockRequestSync).not.toHaveBeenCalled();
    expect(mockPageOpened).not.toHaveBeenCalled();
  });

  it('reads again when the account publishes progress', async () => {
    renderHook(() => useLocalWalletSendReadiness(props));
    expect(mockRun).not.toHaveBeenCalled();
    await act(async () => {
      getDefaultStore().set(privacyChainAtom.atom(), {
        progress: { [`${props.networkId}:${props.accountId}`]: {} },
      } as never);
    });
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the gate closed when the readiness read fails', async () => {
    const { result } = renderHook(() => useLocalWalletSendReadiness(props));
    mockGetReadiness.mockRejectedValueOnce(new Error('bg gone'));
    await expect(mockRequest?.()).rejects.toThrow('bg gone');
    expect(result.current.isWaitingForSync).toBe(true);
  });
});

describe('useLocalWalletSendPrewarm', () => {
  beforeEach(() => {
    mockPrewarm.mockClear();
  });

  // The send sync needs the thread first; prewarming then runs while the amount is typed.
  it('waits for the send sync before prewarming', () => {
    const params = {
      enabled: true,
      networkId: 'zec--0',
      accountId: 'account',
      sourcePool: 'ironwood',
      toAddress: 'u1-recipient',
      isWaitingForSync: true,
    };
    const { rerender } = renderHook(
      (hookParams: typeof params) => useLocalWalletSendPrewarm(hookParams),
      { initialProps: params },
    );
    expect(mockPrewarm).not.toHaveBeenCalled();

    rerender({ ...params, isWaitingForSync: false });
    expect(mockPrewarm).toHaveBeenCalledTimes(1);
    expect(mockPrewarm).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'account',
      sourcePool: 'ironwood',
      toAddress: 'u1-recipient',
    });
  });
});
