import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

// Service module options for select component
export const serviceModuleOptions = Object.values(EServiceEndpointEnum).map(
  (value) => ({
    label: value,
    value,
  }),
);

// Service module labels for display
export const serviceModuleLabels: Record<EServiceEndpointEnum, string> = {
  wallet: 'Wallet',
  swap: 'Swap',
  utility: 'Utility',
  lightning: 'Lightning',
  earn: 'Earn',
  notification: 'Notification',
  notificationWebSocket: 'Notification WebSocket',
  prime: 'Prime',
  transfer: 'Transfer',
  rebate: 'Rebate',
};
