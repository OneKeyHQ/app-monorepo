import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
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
  actionTranslationId,
  onCloseDialog,
  tradeType,
}: {
  customMessage?: string;
  actionToken?: ISwapToken;
  actionTranslationId?: ETranslations;
  onCloseDialog?: () => void;
  tradeType: ESwapDirection;
}) {
  const intl = useIntl();
  const [, setSwapFromMarketJumpTokenAtom] = useSwapFromMarketJumpTokenAtom();
  const navigation = useAppNavigation();
  const handleAlertAction = useCallback(
    (actionName: string) => {
      onCloseDialog?.();
      if (actionName === 'bridge_action') {
        setSwapFromMarketJumpTokenAtom({
          token: actionToken,
          type: ESwapTabSwitchType.BRIDGE,
          direction: tradeType === ESwapDirection.BUY ? 'to' : 'from',
        });
        navigation.switchTab(ETabRoutes.Swap);
      } else if (actionName === 'swap_action') {
        setSwapFromMarketJumpTokenAtom({
          token: actionToken,
          type: ESwapTabSwitchType.SWAP,
          direction: tradeType === ESwapDirection.BUY ? 'to' : 'from',
        });
        navigation.switchTab(ETabRoutes.Swap);
      }
    },
    [
      onCloseDialog,
      setSwapFromMarketJumpTokenAtom,
      actionToken,
      tradeType,
      navigation,
    ],
  );
  const description = useMemo(() => {
    if (actionTranslationId) {
      return undefined;
    }
    return (
      customMessage ||
      intl.formatMessage({ id: ETranslations.dexmarket_swap_unsupported_desc })
    );
  }, [actionTranslationId, customMessage, intl]);
  const descriptionComponent = useMemo(() => {
    if (actionTranslationId) {
      return (
        <HyperlinkText
          size="$bodyMd"
          color="$textSubdued"
          translationId={actionTranslationId}
          onAction={(actionName) => {
            void handleAlertAction(actionName);
          }}
        />
      );
    }
    return undefined;
  }, [actionTranslationId, handleAlertAction]);
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
