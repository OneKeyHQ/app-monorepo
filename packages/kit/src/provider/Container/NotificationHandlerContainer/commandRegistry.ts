import { ENotificationCommand } from '@onekeyhq/shared/types/notification';

type ICommandContext = {
  toInviteRewardPage: (params?: {
    showRewardDistributionHistory?: boolean;
  }) => Promise<void>;
  openHardwareSalesOrderDetail: (orderId: string) => Promise<void>;
};

type ICommandHandler = (params: {
  context: ICommandContext;
  data?: Record<string, unknown>;
}) => void | Promise<void>;

const notificationCommandRegistry: Record<string, ICommandHandler> = {
  [ENotificationCommand.openRewardDistributionHistoryModal]: ({ context }) => {
    void context.toInviteRewardPage({ showRewardDistributionHistory: true });
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
