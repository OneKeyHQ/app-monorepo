import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

import { whenAppUnlocked } from '../../../utils/passwordUtils';

import { executeNotificationCommand } from './commandRegistry';

const mockTakePending = jest.fn<
  Promise<{ conversationId?: string } | undefined>,
  []
>();
const mockPlatformEnv = { isExtension: false, isExtensionUiExpandTab: false };

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isExtension() {
      return mockPlatformEnv.isExtension;
    },
    get isExtensionUiExpandTab() {
      return mockPlatformEnv.isExtensionUiExpandTab;
    },
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      takePendingSupportConversation: () => mockTakePending(),
    },
  },
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: jest.fn(),
}));

const context = {
  toInviteRewardPage: jest.fn(),
  openHardwareSalesOrderDetail: jest.fn(),
};

function openSupport() {
  return executeNotificationCommand(
    ENotificationCommand.openSupportConversation,
    context,
  );
}

describe('support conversation notification command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isExtension = false;
    mockPlatformEnv.isExtensionUiExpandTab = false;
  });

  it('claims and opens the conversation only after unlock', async () => {
    mockTakePending.mockResolvedValueOnce({
      conversationId: 'conversation-123',
    });
    let unlock: (() => void) | undefined;
    jest.mocked(whenAppUnlocked).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          unlock = resolve;
        }),
    );

    const result = openSupport();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(whenAppUnlocked).toHaveBeenCalledTimes(1);
    expect(mockTakePending).not.toHaveBeenCalled();
    expect(showIntercom).not.toHaveBeenCalled();

    unlock?.();
    await expect(result).resolves.toBe(true);
    expect(showIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-123',
    });
  });

  it('opens the default support entry when the claim has no id', async () => {
    mockTakePending.mockResolvedValueOnce({});
    await expect(openSupport()).resolves.toBe(true);
    expect(whenAppUnlocked).toHaveBeenCalledTimes(1);
    expect(showIntercom).toHaveBeenCalledWith({ conversationId: undefined });
  });

  it('does nothing when no support request is pending', async () => {
    mockTakePending.mockResolvedValueOnce(undefined);
    await expect(openSupport()).resolves.toBe(true);
    expect(showIntercom).not.toHaveBeenCalled();
  });

  it('routes a UI click to its source instead of every mounted foreground', async () => {
    mockPlatformEnv.isExtension = true;
    mockPlatformEnv.isExtensionUiExpandTab = true;
    await executeNotificationCommand(
      ENotificationCommand.openSupportConversation,
      context,
      { targetNodeId: 'another-runtime' },
    );
    expect(mockTakePending).not.toHaveBeenCalled();
    mockPlatformEnv.isExtensionUiExpandTab = false;
    mockTakePending.mockResolvedValueOnce({ conversationId: 'c' });
    await executeNotificationCommand(
      ENotificationCommand.openSupportConversation,
      context,
      { targetNodeId: appEventBus.nodeId },
    );
    expect(showIntercom).toHaveBeenCalledWith({ conversationId: 'c' });
  });

  it('leaves extension popups to the expand tab', async () => {
    mockPlatformEnv.isExtension = true;
    await expect(openSupport()).resolves.toBe(true);
    expect(mockTakePending).not.toHaveBeenCalled();

    mockPlatformEnv.isExtensionUiExpandTab = true;
    mockTakePending.mockResolvedValueOnce({ conversationId: 'conversation-1' });
    await openSupport();
    expect(showIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
    });
  });
});
