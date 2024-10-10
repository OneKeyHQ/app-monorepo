import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Toast, YStack } from '@onekeyhq/components';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useSwapSelectTokenDetailFetchingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useAccountManualCreatingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ISwapAlertActionData,
  ISwapAlertState,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapAlertActionType,
  ESwapAlertLevel,
} from '@onekeyhq/shared/types/swap/types';

export interface ISwapAlertContainerProps {
  alerts: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) => {
  const alertsSorted = useMemo(
    () =>
      alerts?.sort((a) => {
        if (a.alertLevel === ESwapAlertLevel.ERROR) {
          return -1;
        }
        if (a.alertLevel === ESwapAlertLevel.INFO) {
          return 0;
        }
        return 1;
      }),
    [alerts],
  );
  const [selectTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const intl = useIntl();
  const [accountManualCreatingAtom, setAccountManualCreatingAtom] =
    useAccountManualCreatingAtom();
  const { createAddress } = useAccountSelectorCreateAddress();

  const handleAlertAction = useCallback(
    async (action?: {
      actionType: ESwapAlertActionType;
      actionLabel?: string;
      actionData?: ISwapAlertActionData;
    }) => {
      if (
        action?.actionType === ESwapAlertActionType.CREATE_ADDRESS &&
        action.actionData?.account
      ) {
        try {
          setAccountManualCreatingAtom((prev) => ({
            ...prev,
            key: action?.actionData?.key,
            isLoading: true,
          }));
          await createAddress({
            num: action?.actionData?.num ?? 0,
            account: action?.actionData?.account,
            selectAfterCreate: false,
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
          });
        } catch (e) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated_fail,
            }),
          });
        } finally {
          setAccountManualCreatingAtom((prev) => ({
            ...prev,
            key: action?.actionData?.key,
            isLoading: false,
          }));
        }
      }
    },
    [createAddress, intl, setAccountManualCreatingAtom],
  );
  if (alertsSorted?.some((item) => item.alertLevel === ESwapAlertLevel.ERROR)) {
    return (
      <YStack gap="$2.5">
        {alertsSorted
          .filter((item) => item.alertLevel === ESwapAlertLevel.ERROR)
          .reverse()
          .map((item, index) => {
            const { message } = item;
            return <Alert key={index} type="critical" description={message} />;
          })}
      </YStack>
    );
  }

  return (
    <YStack gap="$2.5">
      {alertsSorted?.map((item, index) => {
        const { message, alertLevel, action, title, icon } = item;
        if (
          action?.actionType === ESwapAlertActionType.CREATE_ADDRESS &&
          action?.actionData?.key === accountManualCreatingAtom.key &&
          !accountManualCreatingAtom.isLoading
        ) {
          return null;
        }
        if (
          (selectTokenDetailLoading.from || selectTokenDetailLoading.to) &&
          action?.actionType === ESwapAlertActionType.TOKEN_DETAIL_FETCHING
        ) {
          return null;
        }
        return (
          <Alert
            key={index}
            type={
              alertLevel === ESwapAlertLevel.WARNING ? 'warning' : 'default'
            }
            title={title}
            description={message}
            action={
              action?.actionLabel
                ? {
                    primary: action?.actionLabel ?? '',
                    onPrimaryPress: () => {
                      void handleAlertAction(action);
                    },
                    isPrimaryLoading:
                      accountManualCreatingAtom.key ===
                        action?.actionData?.key &&
                      accountManualCreatingAtom.isLoading,
                  }
                : undefined
            }
          />
        );
      }) ?? null}
    </YStack>
  );
};

export default memo(SwapAlertContainer);
