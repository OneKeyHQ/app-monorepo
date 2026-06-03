import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapFromMarketJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../hooks/useTradeType';

export function UnsupportedSwapWarning({
  customMessage,
  actionToken,
  showSwapAction,
  onCloseDialog,
  tradeType,
}: {
  customMessage?: string;
  actionToken?: ISwapToken;
  showSwapAction?: boolean;
  onCloseDialog?: () => void;
  tradeType: ESwapDirection;
}) {
  const intl = useIntl();
  const [, setSwapFromMarketJumpTokenAtom] = useSwapFromMarketJumpTokenAtom();
  const navigation = useAppNavigation();
  const handleAlertAction = useCallback(() => {
    onCloseDialog?.();
    setSwapFromMarketJumpTokenAtom({
      token: actionToken,
      type: ESwapTabSwitchType.SWAP,
      direction: tradeType === ESwapDirection.BUY ? 'to' : 'from',
    });
    navigation.switchTab(ETabRoutes.Swap);
  }, [
    onCloseDialog,
    setSwapFromMarketJumpTokenAtom,
    actionToken,
    tradeType,
    navigation,
  ]);
  const descriptionText = useMemo(() => {
    return (
      customMessage ||
      intl.formatMessage({ id: ETranslations.dexmarket_swap_unsupported_desc })
    );
  }, [customMessage, intl]);
  const description = showSwapAction ? undefined : descriptionText;
  const descriptionComponent = useMemo(() => {
    if (!showSwapAction) {
      return undefined;
    }
    return (
      <XStack flexWrap="wrap" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {descriptionText}
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          cursor="pointer"
          textDecorationLine="underline"
          onPress={handleAlertAction}
        >
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </SizableText>
      </XStack>
    );
  }, [descriptionText, handleAlertAction, intl, showSwapAction]);
  return (
    <Alert
      icon="InfoCircleOutline"
      title={intl.formatMessage({
        id: ETranslations.dexmarket_swap_unsupported_title,
      })}
      type="warning"
      description={description}
      descriptionComponent={descriptionComponent}
    />
  );
}
