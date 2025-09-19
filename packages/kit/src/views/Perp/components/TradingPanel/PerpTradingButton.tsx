import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsSelectedAccountAtom,
  usePerpsSelectedAccountStatusAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [{ perpConfigCommon }] = useSettingsPersistAtom();

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

  const buttonDisabled = useMemo(() => {
    return (
      !(Number(formData.size) > 0) ||
      !perpsAccountStatus.canTrade ||
      isSubmitting ||
      isNoEnoughMargin ||
      isAccountLoading ||
      (perpsAccountStatus.canTrade &&
        (perpConfigCommon?.disablePerpActionButton ||
          perpConfigCommon?.ipDisablePerp))
    );
  }, [
    formData.size,
    perpsAccountStatus.canTrade,
    isSubmitting,
    isNoEnoughMargin,
    isAccountLoading,
    perpConfigCommon?.disablePerpActionButton,
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
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_place_order,
    });
  }, [isSubmitting, isNoEnoughMargin, intl]);

  const buttonStyles = useMemo(() => {
    const isLong = formData.side === 'long';

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
  }, [formData.side, buttonDisabled, isAccountLoading]);

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
      onPress={() => {
        handleShowConfirm();
      }}
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
