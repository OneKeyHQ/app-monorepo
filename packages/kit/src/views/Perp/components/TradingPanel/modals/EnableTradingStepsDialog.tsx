import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  getPerpsOrderPanelEnableTradingSignatureCount,
  getPerpsOrderPanelEnableTradingSteps,
} from '../../../utils/perpsOrderPanelEnableTrading';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

import type { IEnableTradingWithDepositFallbackResult } from '../../../hooks/useEnableTradingWithDepositFallback';

type IEnableTradingStepsDialogConfirmContext = {
  closeDialog: () => void;
};

type IEnableTradingStepsDialogConfirm = (
  context: IEnableTradingStepsDialogConfirmContext,
) => Promise<IEnableTradingWithDepositFallbackResult | undefined>;

function EnableTradingStepsContent({
  accountStatus,
  onCancel,
  onConfirm,
}: {
  accountStatus: IPerpsActiveAccountStatusAtom;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  const [isConfirming, setIsConfirming] = useState(false);
  const steps = useMemo(
    () => getPerpsOrderPanelEnableTradingSteps(accountStatus),
    [accountStatus],
  );
  const signatureSteps = useMemo(
    () => steps.filter((step) => step.requiresSignature),
    [steps],
  );
  const signatureCount = useMemo(
    () => getPerpsOrderPanelEnableTradingSignatureCount(steps),
    [steps],
  );
  const handleConfirm = useCallback(async () => {
    if (isConfirming) {
      return;
    }
    setIsConfirming(true);
    await onConfirm();
  }, [isConfirming, onConfirm]);

  return (
    <YStack gap="$4" p="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_enable_trading_desc,
        })}
      </SizableText>

      {signatureCount > 0 ? (
        <YStack gap="$2">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMdMedium" color="$text">
              {intl.formatMessage({
                id: ETranslations.global_confirm_on_device,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {signatureCount}
            </SizableText>
          </XStack>

          {signatureSteps.map((step, index) => (
            <XStack key={step.key} gap="$2" alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                {index + 1}.
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({ id: step.labelId })}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}

      <XStack gap="$2">
        <Button
          testID="perp-enable-trading-steps-cancel"
          flex={1}
          variant="secondary"
          onPress={onCancel}
          disabled={isConfirming}
        >
          {intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
        </Button>
        <Button
          testID="perp-enable-trading-steps-continue"
          flex={1}
          variant="primary"
          onPress={handleConfirm}
          loading={isConfirming}
          disabled={isConfirming}
        >
          {intl.formatMessage({
            id: ETranslations.global_continue,
          })}
        </Button>
      </XStack>
    </YStack>
  );
}

export function showEnableTradingStepsDialog({
  accountStatus,
  onConfirm,
}: {
  accountStatus: IPerpsActiveAccountStatusAtom;
  onConfirm: IEnableTradingStepsDialogConfirm;
}): Promise<IEnableTradingWithDepositFallbackResult | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (
      value: IEnableTradingWithDepositFallbackResult | undefined,
    ) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const dialogInstance = Dialog.show({
      disableDrag: true,
      dismissOnOverlayPress: false,
      showExitButton: false,
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.perp_trade_button_enable_trading,
      }),
      renderContent: (
        <EnableTradingStepsContent
          accountStatus={accountStatus}
          onCancel={() => {
            settle(undefined);
            void dialogInstance.close();
          }}
          onConfirm={async () => {
            const closeDialog = () => {
              void dialogInstance.close();
            };
            let result: IEnableTradingWithDepositFallbackResult | undefined;
            try {
              result = await onConfirm({ closeDialog });
            } catch {
              result = undefined;
            } finally {
              settle(result);
              closeDialog();
            }
          }}
        />
      ),
      contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
      showFooter: false,
      onClose: () => {
        settle(undefined);
      },
    });
  });
}
