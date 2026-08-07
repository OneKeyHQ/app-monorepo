import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { activateCustomInjectedWorkspace } from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import { showCustomInjectionSettingsDialog } from '@onekeyhq/kit/src/views/Discovery/components/CustomInjectionSettingsDialog';
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

jest.mock('@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime', () => ({
  activateCustomInjectedWorkspace: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Discovery/components/CustomInjectionSettingsDialog',
  () => ({
    showCustomInjectionSettingsDialog: jest.fn(),
  }),
);

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInDiscovery: jest.fn(),
}));

const showDialog = Dialog.show as jest.MockedFunction<typeof Dialog.show>;
const mockedOpenUrlInDiscovery = openUrlInDiscovery as jest.MockedFunction<
  typeof openUrlInDiscovery
>;
const mockedActivateCustomInjectedWorkspace =
  activateCustomInjectedWorkspace as jest.MockedFunction<
    typeof activateCustomInjectedWorkspace
  >;
const mockedShowCustomInjectionSettingsDialog =
  showCustomInjectionSettingsDialog as jest.MockedFunction<
    typeof showCustomInjectionSettingsDialog
  >;
const mockedDevSettingService =
  backgroundApiProxy.serviceDevSetting as unknown as {
    getDevSetting: jest.Mock;
  };

describe('handleCustomInjectedDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedActivateCustomInjectedWorkspace.mockResolvedValue({} as never);
    mockedShowCustomInjectionSettingsDialog.mockResolvedValue(true);
  });

  it('blocks the shortcut while Developer Settings is disabled', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({
      enabled: false,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
        },
      },
    });

    await handleCustomInjectedDeepLink({ workspace: '/workspace' });

    expect(mockedActivateCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(mockedShowCustomInjectionSettingsDialog).not.toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Developer settings required' }),
    );
  });

  it('opens the settings modal for a different workspace', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/old-workspace',
        },
      },
    });

    await handleCustomInjectedDeepLink({
      workspace: '/new-workspace',
      url: 'https://app.uniswap.org',
    });

    expect(mockedActivateCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(mockedShowCustomInjectionSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedWorkspace: '/new-workspace',
        onSaved: expect.any(Function),
      }),
    );
    const options = mockedShowCustomInjectionSettingsDialog.mock.calls[0]?.[0];
    await options?.onSaved?.({
      enabled: true,
      workspace: '/new-workspace',
    });
    expect(mockedOpenUrlInDiscovery).toHaveBeenCalledWith({
      url: 'https://app.uniswap.org',
    });
    expect(showDialog).not.toHaveBeenCalled();
  });

  it('reuses a matching persisted config without opening the modal', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
        },
      },
    });

    await handleCustomInjectedDeepLink({
      workspace: '/workspace',
      url: 'https://app.uniswap.org/swap',
    });

    expect(mockedActivateCustomInjectedWorkspace).toHaveBeenCalledWith({
      workspace: '/workspace',
      devSettingsEnabled: true,
      customInjectionEnabled: true,
    });
    expect(mockedShowCustomInjectionSettingsDialog).not.toHaveBeenCalled();
    expect(mockedOpenUrlInDiscovery).toHaveBeenCalledWith({
      url: 'https://app.uniswap.org/swap',
    });
  });

  it('uses the current persisted config for a URL-only shortcut', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
        },
      },
    });

    await handleCustomInjectedDeepLink({
      url: 'https://app.elk.finance/swap',
    });

    expect(mockedActivateCustomInjectedWorkspace).toHaveBeenCalledWith({
      workspace: '/workspace',
      devSettingsEnabled: true,
      customInjectionEnabled: true,
    });
    expect(mockedOpenUrlInDiscovery).toHaveBeenCalledWith({
      url: 'https://app.elk.finance/swap',
    });
    expect(mockedShowCustomInjectionSettingsDialog).not.toHaveBeenCalled();
  });

  it('rejects an unsafe target URL before opening settings', async () => {
    mockedDevSettingService.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: {},
    });

    await handleCustomInjectedDeepLink({
      workspace: '/workspace',
      url: 'file:///tmp/dapp.html',
    });

    expect(mockedShowCustomInjectionSettingsDialog).not.toHaveBeenCalled();
    expect(mockedOpenUrlInDiscovery).not.toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invalid custom injection link' }),
    );
  });
});
