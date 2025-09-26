import { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, Spinner, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsCommonConfigPersistAtom,
  usePerpsSelectedAccountAtom,
  usePerpsSelectedAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentTokenData } from '../../hooks';

import { showDepositWithdrawModal } from './modals/DepositWithdrawModal';

export function PerpTradingButton({
  loading,
  handleShowConfirm,
  formData,
  isSubmitting,
  isNoEnoughMargin,
}: {
  loading: boolean;
  handleShowConfirm: () => void;
  formData: ITradingFormData;
  isSubmitting: boolean;
  isNoEnoughMargin: boolean;
}) {
  const intl = useIntl();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const tokenInfo = useCurrentTokenData();
  const [perpsAccount] = usePerpsSelectedAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsSelectedAccountStatusAtom();

  const isAccountLoading = useMemo(() => {
    return (
      perpsAccountLoading.enableTradingLoading ||
      perpsAccountLoading.selectAccountLoading
    );
  }, [
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.selectAccountLoading,
  ]);

  const enableTrading = useCallback(async () => {
    const status = await backgroundApiProxy.serviceHyperliquid.enableTrading();
    if (
      !status.details.activatedOk &&
      perpsAccount.accountAddress &&
      perpsAccount.accountId
    ) {
      await showDepositWithdrawModal({
        withdrawable: '0',
        actionType: 'deposit',
      });
    }
  }, [perpsAccount.accountAddress, perpsAccount.accountId]);

  const isMinimumOrderNotMet = useMemo(() => {
    const size = BigNumber(formData.size);
    const price = BigNumber(formData.price);
    const leverage = BigNumber(formData.leverage || 1);

    if (!size || !price || size.lte(0) || price.lte(0)) {
      return false;
    }

    const orderValue = size.multipliedBy(price).multipliedBy(leverage);
    return orderValue.lt(10);
  }, [formData.size, formData.price, formData.leverage]);

  const buttonDisabled = useMemo(() => {
    return (
      !(Number(formData.size) > 0) ||
      !perpsAccountStatus.canTrade ||
      isSubmitting ||
      isNoEnoughMargin ||
      isAccountLoading ||
      isMinimumOrderNotMet ||
      (perpsAccountStatus.canTrade &&
        (perpConfigCommon?.disablePerpActionPerp ||
          perpConfigCommon?.ipDisablePerp))
    );
  }, [
    formData.size,
    perpsAccountStatus.canTrade,
    isSubmitting,
    isNoEnoughMargin,
    isAccountLoading,
    isMinimumOrderNotMet,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
  ]);
  const buttonText = useMemo(() => {
    if (isSubmitting)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    if (isNoEnoughMargin)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_no_enough_margin,
      });
    if (isMinimumOrderNotMet) return 'Order must be at least $10'; // TODO: I18n
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_place_order,
    });
  }, [isSubmitting, isNoEnoughMargin, isMinimumOrderNotMet, intl]);

  const isLong = useMemo(() => formData.side === 'long', [formData.side]);
  const buttonStyles = useMemo(() => {
    const getBgColor = () => {
      if (isAccountLoading) return undefined;
      return isLong ? '#18794E' : '#E5484D';
    };

    const getHoverBgColor = () => {
      if (isAccountLoading) return undefined;
      return isLong ? '$green8' : '$red10';
    };

    const getPressBgColor = () => {
      if (isAccountLoading) return undefined;
      return isLong ? '$green9' : '$red9';
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
      textColor: buttonDisabled ? '$textDisabled' : '$textOnColor',
    };
  }, [buttonDisabled, isAccountLoading, isLong]);

  const createAddressButtonRender = useCallback((props: IButtonProps) => {
    return <Button size="medium" borderRadius="$3" {...props} />;
  }, []);

  const accountNotSupportedButton = useMemo(() => {
    return createAddressButtonRender({
      children: intl.formatMessage({
        id: ETranslations.perp_trade_button_account_unsupported,
      }),
      disabled: true,
    });
  }, [createAddressButtonRender, intl]);

  const getTpslErrorMessage = useCallback(
    (type: 'TP' | 'SL', direction: 'higher' | 'lower') => ({
      title: `${type} price must be ${direction} than current price. To close position immediately, use the position table or order form.`,
    }),
    [],
  );

  const validateTpslPrices = useCallback(() => {
    if (!formData.hasTpsl || !formData.price) return true;

    const entryPrice = new BigNumber(
      formData.type === 'limit' ? formData.price : tokenInfo?.markPx || '0',
    );
    if (!entryPrice.isFinite() || entryPrice.isZero()) {
      // entry price is invalid
      return true;
    }
    const tpPrice = formData.tpTriggerPx
      ? new BigNumber(formData.tpTriggerPx)
      : null;
    const slPrice = formData.slTriggerPx
      ? new BigNumber(formData.slTriggerPx)
      : null;

    // Validate Take Profit
    if (tpPrice) {
      if (isLong && tpPrice.lte(entryPrice)) {
        Toast.error(getTpslErrorMessage('TP', 'higher'));
        return false;
      }
      if (!isLong && tpPrice.gte(entryPrice)) {
        Toast.error(getTpslErrorMessage('TP', 'lower'));
        return false;
      }
    }

    // Validate Stop Loss
    if (slPrice) {
      if (isLong && slPrice.gte(entryPrice)) {
        Toast.error(getTpslErrorMessage('SL', 'lower'));
        return false;
      }
      if (!isLong && slPrice.lte(entryPrice)) {
        Toast.error(getTpslErrorMessage('SL', 'higher'));
        return false;
      }
    }

    return true;
  }, [
    formData.hasTpsl,
    formData.price,
    formData.type,
    tokenInfo?.markPx,
    formData.tpTriggerPx,
    formData.slTriggerPx,
    isLong,
    getTpslErrorMessage,
  ]);

  const orderConfirm = useCallback(() => {
    // Validate TPSL prices before proceeding
    if (!validateTpslPrices()) {
      return;
    }

    handleShowConfirm();
  }, [validateTpslPrices, handleShowConfirm]);

  if (loading || perpsAccountLoading?.selectAccountLoading) {
    return (
      <Button size="medium" borderRadius="$3" disabled>
        <Spinner />
      </Button>
    );
  }

  if (!perpsAccount?.accountAddress) {
    const canCreateAddress = !!perpsAccount.indexedAccountId;
    if (canCreateAddress) {
      const createAddressAccount = {
        ...selectedAccount,
        deriveType: perpsAccount.deriveType,
        indexedAccountId:
          perpsAccount.indexedAccountId || selectedAccount.indexedAccountId,
        // networkId: PERPS_NETWORK_ID,
        networkId: getNetworkIdsMap().onekeyall,
      };
      return (
        <AccountSelectorCreateAddressButton
          autoCreateAddress={false}
          num={0}
          account={createAddressAccount}
          buttonRender={createAddressButtonRender}
        />
      );
    }
    return accountNotSupportedButton;
  }

  if (
    isAccountLoading ||
    !perpsAccountStatus.canTrade ||
    !perpsAccount?.accountAddress
  ) {
    return (
      <Button
        size="medium"
        borderRadius="$3"
        bg="#18794E"
        hoverStyle={{ bg: '$green8' }}
        pressStyle={{ bg: '$green8' }}
        loading={isAccountLoading}
        onPress={async () => {
          await enableTrading();
        }}
      >
        <SizableText size="$bodyMdMedium" color="$textOnColor">
          {intl.formatMessage({
            id: ETranslations.perp_trade_button_enable_trading,
          })}
        </SizableText>
      </Button>
    );
  }

  return (
    <Button
      bg={buttonStyles.bg}
      hoverStyle={{ bg: buttonStyles.hoverBg }}
      pressStyle={{ bg: buttonStyles.pressBg }}
      loading={perpsAccountLoading?.enableTradingLoading || isSubmitting}
      onPress={orderConfirm}
      disabled={buttonDisabled}
      size="medium"
      borderRadius="$3"
    >
      <SizableText color={buttonStyles.textColor} size="$bodyMdMedium">
        {buttonText}
      </SizableText>
    </Button>
  );
}
