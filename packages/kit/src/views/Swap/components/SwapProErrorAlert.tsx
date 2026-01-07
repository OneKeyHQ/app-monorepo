import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { HyperlinkText } from '../../../components/HyperlinkText';
import {
  useSwapActions,
  useSwapProDirectionAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

interface ISwapProErrorAlertProps {
  title?: string;
  message?: string;
  supportSpeedSwap?: boolean;
  onlySupportCrossChain?: boolean;
  actionToken?: ISwapToken;
}

const SwapProErrorAlert = ({
  title,
  message,
  supportSpeedSwap,
  onlySupportCrossChain,
  actionToken,
}: ISwapProErrorAlertProps) => {
  const intl = useIntl();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const { selectToToken, selectFromToken } = useSwapActions().current;
  const [swapSelectToken, setSwapSelectFromToken] =
    useSwapSelectFromTokenAtom();
  const [swapSelectToToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();

  const handleAlertAction = useCallback(
    (actionName: string) => {
      if (actionName === 'bridge_action') {
        void setSwapTypeSwitch(ESwapTabSwitchType.BRIDGE);
      } else if (actionName === 'swap_action') {
        void setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
      }
      if (swapProDirection === ESwapDirection.BUY) {
        if (
          equalTokenNoCaseSensitive({
            token1: swapSelectToken,
            token2: actionToken,
          }) &&
          actionToken
        ) {
          void setSwapSelectFromToken(undefined);
        }
        if (actionToken) {
          void selectToToken(actionToken);
        }
      } else {
        if (
          equalTokenNoCaseSensitive({
            token1: swapSelectToToken,
            token2: actionToken,
          }) &&
          actionToken
        ) {
          void setSwapSelectToToken(undefined);
        }
        if (actionToken) {
          void selectFromToken(actionToken);
        }
      }
    },
    [
      setSwapTypeSwitch,
      swapProDirection,
      swapSelectToken,
      actionToken,
      setSwapSelectFromToken,
      selectToToken,
      swapSelectToToken,
      setSwapSelectToToken,
      selectFromToken,
    ],
  );
  const titleValue = useMemo(() => {
    if (!supportSpeedSwap) {
      return intl.formatMessage({
        id: ETranslations.promode_swap_unsupported_title,
      });
    }
    return title;
  }, [supportSpeedSwap, title, intl]);
  const messageComponent = useMemo(() => {
    if (!supportSpeedSwap) {
      return (
        <HyperlinkText
          size="$bodyMd"
          color="$textSubdued"
          translationId={
            onlySupportCrossChain
              ? ETranslations.promode_swap_unsupported_message_btc
              : ETranslations.promode_swap_unsupported_message_regular
          }
          onAction={(actionName) => {
            void handleAlertAction(actionName);
          }}
        />
      );
    }
    return undefined;
  }, [supportSpeedSwap, onlySupportCrossChain, handleAlertAction]);

  if (!titleValue && !message) {
    return null;
  }
  return (
    <Alert
      type="warning"
      title={titleValue}
      icon="InfoCircleOutline"
      description={messageComponent ? undefined : message}
      descriptionComponent={messageComponent}
    />
  );
};

export default SwapProErrorAlert;
