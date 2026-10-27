import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

type ICommandContext = {
  toInviteRewardPage: (params?: IInviteRewardRouteParams) => Promise<void>;
  openHardwareSalesOrderDetail: (orderId: string) => Promise<void>;
};

type ICommandHandler = (params: {
  context: ICommandContext;
  data?: Record<string, unknown>;
}) => void | Promise<void>;

const notificationCommandRegistry: Record<string, ICommandHandler> = {
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

export function executeNotificationCommand(
  action: string,
  context: ICommandContext,
  data?: Record<string, unknown>,
): boolean {
  const handler = notificationCommandRegistry[action];
  if (!handler) {
    console.warn(`[Notification] Unknown action: ${action}`);
    return false;
  }
  void handler({ context, data });
  return true;
}
