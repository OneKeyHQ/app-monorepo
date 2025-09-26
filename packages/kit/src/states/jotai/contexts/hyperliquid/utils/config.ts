import { EActionType, EErrorType } from './types';

import type { IToastConfig } from './types';

export const ERROR_PATTERNS: Record<EErrorType, string[]> = {
  [EErrorType.INVALID_AGENT]: ['User or API Wallet', 'does not exist'],
};

export const ERROR_MESSAGES: Record<EErrorType, string> = {
  [EErrorType.INVALID_AGENT]: 'Please enable trading to continue',
};

export const TOAST_CONFIGS: Record<EActionType, IToastConfig> = {
  [EActionType.PLACE_ORDER]: {
    loading: 'Placing order...',
    successTitle: 'Order Submitted',
    successMessage: 'Your order has been placed successfully',
  },

  [EActionType.ORDER_OPEN]: {
    loading: 'Opening position...',
    successTitle: 'Position Order Submitted',
    successMessage: 'Your position order has been placed successfully',
  },

  [EActionType.ORDER_CLOSE]: {
    loading: 'Closing position...',
    successTitle: 'Close Order Submitted',
    successMessage: 'Your close order has been placed successfully',
  },

  [EActionType.LIMIT_ORDER_CLOSE]: {
    loading: 'Placing limit close order...',
    successTitle: 'Limit Close Order Submitted',
    successMessage: 'Your limit close order has been placed successfully',
  },

  [EActionType.UPDATE_LEVERAGE]: {
    loading: 'Updating leverage...',
    successTitle: 'Leverage Updated',
    successMessage: (leverage: number, mode: string) =>
      `${mode} leverage set to ${leverage}x successfully`,
  },

  [EActionType.SET_POSITION_TPSL]: {
    loading: 'Setting TP/SL...',
    successTitle: 'TP/SL Set Successfully',
    successMessage: 'Position TP/SL orders have been placed',
  },

  [EActionType.CANCEL_ORDER]: {
    loading: (count: number) =>
      `Canceling ${count} order${count > 1 ? 's' : ''}...`,
    successTitle: 'Orders Canceled',
    successMessage: (count: number) =>
      `Successfully canceled ${count} order${count > 1 ? 's' : ''}`,
  },

  [EActionType.WITHDRAW]: {
    loading: 'Processing withdrawal...',
    successTitle: 'Withdraw Initiated',
    successMessage: (amount: string) =>
      `${amount} USD withdrawal has been submitted`,
  },
};
