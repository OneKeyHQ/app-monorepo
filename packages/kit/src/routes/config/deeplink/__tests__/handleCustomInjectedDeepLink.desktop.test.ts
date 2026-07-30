import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { setActiveCustomInjectedWorkspace } from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { handleCustomInjectedDeepLink } from '../handleCustomInjectedDeepLink.desktop';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getDevSetting: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInDiscovery: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime', () => ({
  setActiveCustomInjectedWorkspace: jest.fn(),
}));

const showDialog = Dialog.show as jest.MockedFunction<typeof Dialog.show>;
const mockedOpenUrlInDiscovery = openUrlInDiscovery as jest.MockedFunction<
  typeof openUrlInDiscovery
>;
const mockedSetActiveCustomInjectedWorkspace =
  setActiveCustomInjectedWorkspace as jest.MockedFunction<
    typeof setActiveCustomInjectedWorkspace
  >;
const mockedDevSettingService =
  backgroundApiProxy.serviceDevSetting as unknown as {
    getDevSetting: jest.Mock;
  };

const customSession = {
  sessionId: 'session-1',
  workspace: '/workspace',
  registrySha256: 'a'.repeat(64),
  bundleSha256: 'b'.repeat(64),
  preloadUrl: 'file:///workspace/injectedDesktopPreload.js?sha256=b',
  protocols: [
    {
      id: 'processed',
      name: 'Processed',
      slug: 'processed',
      url: 'https://processed.example',
      urlSource: 'defillama' as const,
      totalTvl: 20,
      bestRank: 1,
      manualReview: {
        state: 'processed' as const,
        reviewedAt: '2026-07-30T00:00:00.000Z',
        reviewedUrl: 'https://processed.example',
        injectedBundleSha256: 'c'.repeat(64),
      },
    },
    {
      id: 'pending',
      name: 'Pending',
      slug: 'pending',
      url: 'https://pending.example',
      urlSource: 'override' as const,
      totalTvl: 10,
      bestRank: 2,
      manualReview: {
        state: 'pending' as const,
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
  ],
};

describe('handleCustomInjectedDeepLink', () => {
  const prepareCustomInjectedWorkspace = jest.fn();
  const activateCustomInjectedWorkspace = jest.fn();
  const closeCustomInjectedWorkspace = jest.fn();
  const createDialogInstance = () => ({
    close: jest.fn(),
    getForm: jest.fn(),
    isExist: jest.fn(() => true),
    preventClose: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          activateCustomInjectedWorkspace,
          closeCustomInjectedWorkspace,
          prepareCustomInjectedWorkspace,
        },
      },
    });
    prepareCustomInjectedWorkspace.mockResolvedValue({
      sessionId: 'session-1',
      workspace: '/workspace',
      protocolRegistry: 'registry.json',
      desktopPreload: 'injectedDesktopPreload.js',
      protocolCount: 2,
      pendingCount: 1,
      bundleSha256: 'b'.repeat(64),
    });
    activateCustomInjectedWorkspace.mockResolvedValue(customSession);
  });

  it('requires enabled developer settings', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({ enabled: false });
    await handleCustomInjectedDeepLink({ workspace: '/workspace' });
    expect(prepareCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Developer settings required' }),
    );
  });

  it('loads the first pending protocol only after confirmation', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({ enabled: true });
    showDialog.mockImplementation((options) => {
      if (options.title === 'Load custom injection workspace?') {
        void options.onConfirm?.(createDialogInstance());
      }
      return createDialogInstance();
    });

    await handleCustomInjectedDeepLink({ workspace: '/workspace' });

    expect(prepareCustomInjectedWorkspace).toHaveBeenCalledWith(
      '/workspace',
      true,
    );
    expect(activateCustomInjectedWorkspace).toHaveBeenCalledWith('session-1');
    expect(mockedSetActiveCustomInjectedWorkspace).toHaveBeenCalledWith(
      customSession,
    );
    expect(mockedOpenUrlInDiscovery).toHaveBeenCalledWith({
      url: 'https://pending.example',
      title: 'Pending',
    });
  });

  it('closes the prepared session when confirmation is canceled', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({ enabled: true });
    showDialog.mockImplementation((options) => {
      if (options.title === 'Load custom injection workspace?') {
        options.onCancel?.(jest.fn());
      }
      return createDialogInstance();
    });

    await handleCustomInjectedDeepLink({ workspace: '/workspace' });

    expect(closeCustomInjectedWorkspace).toHaveBeenCalledWith('session-1');
    expect(activateCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(mockedOpenUrlInDiscovery).not.toHaveBeenCalled();
  });
});
