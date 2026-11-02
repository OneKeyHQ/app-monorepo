import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';

type ICommandContext = {
  toInviteRewardPage: (params?: IInviteRewardRouteParams) => Promise<void>;
  openHardwareSalesOrderDetail: (orderId: string) => Promise<void>;
};

type ICommandHandler = (params: {
  context: ICommandContext;
  data?: Record<string, unknown>;
}) => void | Promise<void>;

const notificationCommandRegistry: Record<string, ICommandHandler> = {
  // The validated conversation id waits in bg until a foreground claims it.
  [ENotificationCommand.openSupportConversation]: async ({ data }) => {
    // Route live UI clicks back to their source, without another wallet tab.
    // An unclaimed intent stays recoverable by a later expand-tab mount.
    if (platformEnv.isExtension) {
      const targetNodeId = data?.targetNodeId;
      if (
        targetNodeId
          ? targetNodeId !== appEventBus.nodeId
          : !platformEnv.isExtensionUiExpandTab
      ) {
        return;
      }
    }
    // Claim only after unlock so a foreground closed while locked keeps it.
    await whenAppUnlocked();
    const pending =
      await backgroundApiProxy.serviceNotification.takePendingSupportConversation();
    if (!pending) {
      return;
    }
    await showIntercom({ conversationId: pending.conversationId });
  },
  [ENotificationCommand.openRewardDistributionHistoryModal]: ({ context }) => {
    // Payout history belongs to the invite tab, so open it under that tab
    // rather than the one the user last left.
    void context.toInviteRewardPage({
      tab: 'invite',
      showRewardDistributionHistory: true,
    });
  },
  [ENotificationCommand.openHardwareSalesOrder]: ({ context, data }) => {
    const orderId = data?.orderId as string;
    if (orderId) {
      void context.openHardwareSalesOrderDetail(orderId);
    }
  },
};

export async function executeNotificationCommand(
  action: string,
  context: ICommandContext,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const handler = notificationCommandRegistry[action];
  if (!handler) {
    console.warn(`[Notification] Unknown action: ${action}`);
    return false;
  }
  await handler({ context, data });
  return true;
}
