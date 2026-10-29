import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

import { whenAppUnlocked } from '../../../utils/passwordUtils';

import { executeNotificationCommand } from './commandRegistry';

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: jest.fn(),
}));

const context = {
  toInviteRewardPage: jest.fn(),
  openHardwareSalesOrderDetail: jest.fn(),
};

describe('support conversation notification command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for unlock before opening the exact conversation', async () => {
    let unlock: (() => void) | undefined;
    jest.mocked(whenAppUnlocked).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          unlock = resolve;
        }),
    );

    const result = executeNotificationCommand(
      ENotificationCommand.openSupportConversation,
      context,
      { conversationId: 'conversation-123' },
    );
    expect(whenAppUnlocked).toHaveBeenCalledTimes(1);
    expect(showIntercom).not.toHaveBeenCalled();

    unlock?.();
    await expect(result).resolves.toBe(true);
    expect(showIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-123',
    });
  });

  it.each([undefined, null])(
    'opens the default support entry after unlock when id is %p',
    async (conversationId) => {
      await executeNotificationCommand(
        ENotificationCommand.openSupportConversation,
        context,
        { conversationId },
      );
      expect(whenAppUnlocked).toHaveBeenCalledTimes(1);
      expect(showIntercom).toHaveBeenCalledWith({ conversationId: undefined });
    },
  );
});
