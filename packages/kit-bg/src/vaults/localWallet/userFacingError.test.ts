import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import { localWalletText } from './messages';
import {
  LOCAL_WALLET_CHAIN_TIP_TIMEOUT_MESSAGE,
  LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE,
  getLocalWalletSyncErrorKind,
  toLocalWalletUserFacingError,
  toastLocalWalletError,
} from './userFacingError';

function workerFailure(message: string) {
  return new OneKeyLocalError({
    message,
    data: { privacyChainRuntimeFailure: 'handshake' },
  });
}

function zcashRuntimeError(code: string) {
  return Object.assign(new Error(code), {
    code,
    payload: { code, params: {} },
  });
}

function xmrRuntimeError(code: string) {
  return new Error(JSON.stringify({ code, params: {} }));
}

describe('toLocalWalletUserFacingError', () => {
  it('words a Worker that never started and toasts it', () => {
    const out = toLocalWalletUserFacingError(
      workerFailure('zcash worker: handshake timed out'),
    );
    expect(out).toMatchObject({
      message: ETranslationsMock.privacy_error_runtime_unavailable__msg,
      autoToast: true,
    });
  });

  it('treats a stuck runtime call like one that never started', () => {
    expect(
      toLocalWalletUserFacingError(
        new OneKeyLocalError('WebEmbed bridge call timeout (60s)'),
      ),
    ).toMatchObject({
      message: ETranslationsMock.privacy_error_runtime_unavailable__msg,
      autoToast: true,
    });
  });

  it.each([
    ['Zcash', zcashRuntimeError('NETWORK_ERROR')],
    ['Monero', xmrRuntimeError('NETWORK_ERROR')],
  ])('uses the node-unreachable copy for a %s network error', (_, error) => {
    expect(toLocalWalletUserFacingError(error)).toMatchObject({
      message: localWalletText(
        ETranslations.privacy_error_node_unreachable__msg,
      ),
      autoToast: true,
    });
  });

  it.each([
    ['STORAGE_UNSUPPORTED', ETranslations.privacy_error_webview_outdated__msg],
    ['DATABASE_TOO_NEW', ETranslations.database_read_error_update_app__msg],
    ['NODE_NOT_CONFIGURED', ETranslations.privacy_error_no_node__msg],
  ])('words %s', (code, id) => {
    expect(toLocalWalletUserFacingError(zcashRuntimeError(code))).toMatchObject(
      { message: localWalletText(id), autoToast: true },
    );
  });

  it('turns on the toast for a plain Error, keeping it as is', () => {
    const error = new Error('something broke');
    const out = toLocalWalletUserFacingError(error);
    expect(out).toBe(error);
    expect(out).toMatchObject({ message: 'something broke', autoToast: true });
  });

  // A password prompt the user closed must stay quiet.
  it('keeps an explicit autoToast=false', () => {
    const cancelled = new OneKeyLocalError({
      message: 'cancelled',
      autoToast: false,
    });
    expect(toLocalWalletUserFacingError(cancelled)).toMatchObject({
      autoToast: false,
    });
  });

  it('keeps an already worded error that already toasts', () => {
    const limit = new OneKeyLocalError({
      message: 'Privacy Mode is limited to 5 accounts at a time.',
      autoToast: true,
    });
    expect(toLocalWalletUserFacingError(limit)).toBe(limit);
  });
});

// The proxy hands every rejected background call to showToastOfError.
it('reaches the standard error toast', async () => {
  const emit = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  try {
    errorToastUtils.showToastOfError(
      toLocalWalletUserFacingError(
        workerFailure('zcash worker: handshake timed out'),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.ShowToast,
      expect.objectContaining({
        method: 'error',
        title: ETranslationsMock.privacy_error_runtime_unavailable__msg,
      }),
    );
  } finally {
    emit.mockRestore();
  }
});

describe('toastLocalWalletError', () => {
  class Service {
    calls = 0;

    @toastLocalWalletError()
    async enable(fail: unknown): Promise<string> {
      this.calls += 1;
      if (fail) throw fail;
      return 'ok';
    }
  }

  it('passes results through and keeps `this`', async () => {
    const service = new Service();
    await expect(service.enable(undefined)).resolves.toBe('ok');
    expect(service.calls).toBe(1);
  });

  it('rejects with the worded, toasting error', async () => {
    await expect(
      new Service().enable(workerFailure('xmr worker: crashed')),
    ).rejects.toMatchObject({
      message: ETranslationsMock.privacy_error_runtime_unavailable__msg,
      autoToast: true,
    });
  });
});

describe('getLocalWalletSyncErrorKind', () => {
  it('names a dead or stuck runtime', () => {
    expect(
      getLocalWalletSyncErrorKind(workerFailure('zcash worker: crashed')),
    ).toBe('runtimeUnavailable');
    expect(
      getLocalWalletSyncErrorKind(
        new OneKeyLocalError(LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE),
      ),
    ).toBe('runtimeUnavailable');
  });

  it('names an unreachable node', () => {
    expect(getLocalWalletSyncErrorKind(xmrRuntimeError('NETWORK_ERROR'))).toBe(
      'nodeUnreachable',
    );
    expect(
      getLocalWalletSyncErrorKind(
        new OneKeyLocalError(LOCAL_WALLET_CHAIN_TIP_TIMEOUT_MESSAGE),
      ),
    ).toBe('nodeUnreachable');
  });

  it('falls back to a generic failure', () => {
    expect(getLocalWalletSyncErrorKind(new Error('boom'))).toBe('failed');
  });

  it('leaves an unsupported device to its own flag', () => {
    expect(
      getLocalWalletSyncErrorKind(zcashRuntimeError('STORAGE_UNSUPPORTED')),
    ).toBeUndefined();
  });
});
