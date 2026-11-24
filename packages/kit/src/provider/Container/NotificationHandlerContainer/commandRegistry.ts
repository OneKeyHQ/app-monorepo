import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import {
  type INotificationPresentation,
  ackNotificationRead,
} from '@onekeyhq/shared/src/utils/notificationsUtils';
import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';

type ICommandContext = {
  toInviteRewardPage: (
    params?: IInviteRewardRouteParams,
    presentation?: INotificationPresentation,
  ) => Promise<void>;
  openHardwareSalesOrderDetail: (
    orderId: string,
    presentation?: INotificationPresentation,
  ) => Promise<void>;
  presentation?: INotificationPresentation;
};

type ICommandHandler = (params: {
  context: ICommandContext;
  data?: Record<string, unknown>;
}) => void | Promise<void>;

const notificationCommandRegistry: Record<string, ICommandHandler> = {
  // The validated conversation id waits in bg until a foreground claims it.
  [ENotificationCommand.openSupportConversation]: async ({ context, data }) => {
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
    if (context.presentation?.canPresent() === false) return;
    const pending =
      await backgroundApiProxy.serviceNotification.takePendingSupportConversation();
    defaultLogger.notification.support.supportReplyClaimed({
      conversationId: pending?.conversationId,
      hasPending: !!pending,
    });
    if (!pending) {
      return;
    }
    if (context.presentation?.canPresent() === false) return;
    const params = { conversationId: pending.conversationId };
    if (context.presentation) {
      await showIntercom(params, {
        canPresent: context.presentation.canPresent,
        onPresented: () => ackNotificationRead(pending.readNotificationId),
      });
    } else {
      await showIntercom(params);
    }
  },
  [ENotificationCommand.openRewardDistributionHistoryModal]: ({ context }) => {
    // Payout history belongs to the invite tab, so open it under that tab
    // rather than the one the user last left.
    return context.toInviteRewardPage(
      {
        tab: 'invite',
        showRewardDistributionHistory: true,
      },
      context.presentation,
    );
  },
  [ENotificationCommand.openHardwareSalesOrder]: ({ context, data }) => {
    const orderId = data?.orderId as string;
    if (orderId) {
      return context.openHardwareSalesOrderDetail(
        orderId,
        context.presentation,
      );
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
