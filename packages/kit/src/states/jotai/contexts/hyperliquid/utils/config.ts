import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { EActionType, EErrorType } from './types';

import type { IToastConfig } from './types';

export const ERROR_PATTERNS: Record<EErrorType, string[]> = {
  [EErrorType.INVALID_AGENT]: ['User or API Wallet', 'does not exist'],
};

export const ERROR_MESSAGES: Record<EErrorType, string> = {
  [EErrorType.INVALID_AGENT]: appLocale.intl.formatMessage({
    id: ETranslations.perp_error_enable,
  }),
};

export const TOAST_CONFIGS: Record<EActionType, IToastConfig> = {
  [EActionType.PLACE_ORDER]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_opening_order,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_order_submitted,
    }),
  },

  [EActionType.ORDER_OPEN]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_placing_order,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_order_submitted,
    }),
  },

  [EActionType.ORDERS_CLOSE]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_closing_position,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_order_submitted,
    }),
  },

  [EActionType.LIMIT_ORDER_CLOSE]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_placing_limit_close,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_placing_limit_close_submit,
    }),
  },

  [EActionType.UPDATE_LEVERAGE]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_upadating_leverage,
    }),
    successTitle: (mode: string) =>
      appLocale.intl.formatMessage(
        {
          id: ETranslations.perp_toast_upadating_leverage_sucess,
        },
        { mode },
      ),
    successMessage: (leverage: number, mode: string) =>
      appLocale.intl.formatMessage(
        {
          id: ETranslations.perp_toast_upadating_leverage_sucess_msg,
        },
        { mode, leverage },
      ),
  },

  [EActionType.UPDATE_ISOLATED_MARGIN]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_trading_adjust_margin_update,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_trading_adjust_margin_updated,
    }),
  },

  [EActionType.SET_POSITION_TPSL]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_setting_tp_sl,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_setting_tp_sl_sucess,
    }),
  },

  [EActionType.CANCEL_ORDER]: {
    loading: (count: number) =>
      appLocale.intl.formatMessage(
        {
          id: ETranslations.perp_toast_canceling_order,
        },
        { count },
      ),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_canceling_order_sucess,
    }),
  },

  [EActionType.WITHDRAW]: {
    loading: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_withdraw_loading,
    }),
    successTitle: appLocale.intl.formatMessage({
      id: ETranslations.perp_toast_withdraw_success,
    }),
    successMessage: (amount: string) =>
      appLocale.intl.formatMessage(
        {
          id: ETranslations.perp_toast_withdraw_success_msg,
        },
        { amount },
      ),
  },
};
