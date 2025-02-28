import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import {
  useSwapActions,
  useSwapSelectTokenDetailFetchingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useAccountManualCreatingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ISwapAlertActionData,
  ISwapAlertState,
  ISwapTokenBase,
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
  const [createAddressError, setCreateAddressError] = useState(false);
  const { selectToToken, selectFromToken } = useSwapActions().current;
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
          setCreateAddressError(false);
        } catch (e) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated_fail,
            }),
          });
          setCreateAddressError(true);
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

  const haveErrorAlert = useMemo(
    () =>
      alertsSorted?.some((item) => item.alertLevel === ESwapAlertLevel.ERROR),
    [alertsSorted],
  );

  const getAlertType = useCallback((level?: ESwapAlertLevel) => {
    if (level === ESwapAlertLevel.ERROR) {
      return 'critical';
    }
    return level === ESwapAlertLevel.WARNING ? 'warning' : 'default';
  }, []);

  const switchToWrappedToken = useCallback(
    (wrappedToken?: ISwapTokenBase) => {
      if (wrappedToken) {
        void selectFromToken(wrappedToken);
      }
    },
    [selectFromToken],
  );

  const wrapToWrappedToken = useCallback(
    (wrappedToken?: ISwapTokenBase) => {
      if (wrappedToken) {
        void selectToToken(wrappedToken);
      }
    },
    [selectToToken],
  );

  const createAlert = useCallback(
    (item: ISwapAlertState, index: number) => {
      const { alertLevel, title, icon, message, action } = item;
      if (
        action?.actionType === ESwapAlertActionType.CREATE_ADDRESS &&
        action?.actionData?.key === accountManualCreatingAtom.key &&
        !accountManualCreatingAtom.isLoading &&
        !createAddressError
      ) {
        return null;
      }
      if (
        (selectTokenDetailLoading.from || selectTokenDetailLoading.to) &&
        action?.actionType === ESwapAlertActionType.TOKEN_DETAIL_FETCHING
      ) {
        return null;
      }
      if (
        haveErrorAlert &&
        item.alertLevel !== ESwapAlertLevel.ERROR &&
        item.action?.actionType !== ESwapAlertActionType.CREATE_ADDRESS
      ) {
        return null;
      }
      if (
        item.action?.actionType === ESwapAlertActionType.LIMIT_NATIVE_WRAPPED &&
        item.action?.actionData?.wrappedToken
      ) {
        return (
          <Alert
            key={index}
            type={getAlertType(alertLevel)}
            title={title}
            icon={icon}
            description={message}
            descriptionComponent={
              <XStack gap="$1">
                <SizableText
                  userSelect="none"
                  cursor="pointer"
                  size="$bodyMd"
                  textDecorationLine="underline"
                  textDecorationStyle="dotted"
                  textDecorationColor="$textDisabled"
                  onPress={() =>
                    switchToWrappedToken(item.action?.actionData?.wrappedToken)
                  }
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                >
                  {intl.formatMessage(
                    {
                      id: ETranslations.Limit_native_token_no_sell_switch,
                    },
                    {
                      token: item.action?.actionData?.wrappedToken?.symbol,
                    },
                  )}
                </SizableText>
                <SizableText size="$bodyMd">
                  {intl.formatMessage({
                    id: ETranslations.global_or,
                  })}
                </SizableText>
                <SizableText
                  userSelect="none"
                  cursor="pointer"
                  size="$bodyMd"
                  textDecorationLine="underline"
                  textDecorationStyle="dotted"
                  textDecorationColor="$textDisabled"
                  onPress={() =>
                    wrapToWrappedToken(item.action?.actionData?.wrappedToken)
                  }
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                >
                  {intl.formatMessage(
                    {
                      id: ETranslations.Limit_native_token_no_sell_wrap,
                    },
                    {
                      token: item.action?.actionData?.wrappedToken?.symbol,
                    },
                  )}
                </SizableText>
              </XStack>
            }
          />
        );
      }

      return (
        <Alert
          key={index}
          type={getAlertType(alertLevel)}
          title={title}
          icon={icon}
          description={message}
          action={
            action?.actionLabel
              ? {
                  primary: action?.actionLabel ?? '',
                  onPrimaryPress: () => {
                    void handleAlertAction(action);
                  },
                  isPrimaryLoading:
                    accountManualCreatingAtom.key === action?.actionData?.key &&
                    accountManualCreatingAtom.isLoading,
                }
              : undefined
          }
        />
      );
    },
    [
      intl,
      accountManualCreatingAtom.isLoading,
      accountManualCreatingAtom.key,
      createAddressError,
      getAlertType,
      handleAlertAction,
      haveErrorAlert,
      selectTokenDetailLoading.from,
      selectTokenDetailLoading.to,
      switchToWrappedToken,
      wrapToWrappedToken,
    ],
  );

  return (
    <YStack gap="$2.5">
      {(haveErrorAlert ? alertsSorted.reverse() : alertsSorted).map(
        (item, index) => createAlert(item, index),
      )}
    </YStack>
  );
};

export default memo(SwapAlertContainer);
