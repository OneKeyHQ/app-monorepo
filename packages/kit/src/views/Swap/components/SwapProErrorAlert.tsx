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
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

interface ISwapProErrorAlertProps {
  title?: string;
  message?: string;
  supportSpeedSwap?: boolean;
  actionToken?: ISwapToken;
}

const SwapProErrorAlert = ({
  title,
  message,
  supportSpeedSwap,
  actionToken,
}: ISwapProErrorAlertProps) => {
  const intl = useIntl();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const { selectToToken } = useSwapActions().current;
  const [swapSelectToken, setSwapSelectFromToken] =
    useSwapSelectFromTokenAtom();

  const handleAlertAction = useCallback(
    (actionName: string) => {
      if (actionName === 'bridge_action') {
        void setSwapTypeSwitch(ESwapTabSwitchType.BRIDGE);
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
      }
    },
    [
      actionToken,
      setSwapSelectFromToken,
      selectToToken,
      setSwapTypeSwitch,
      swapSelectToken,
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
          translationId={ETranslations.promode_swap_unsupported_message}
          onAction={(actionName) => {
            void handleAlertAction(actionName);
          }}
        />
      );
    }
    return undefined;
  }, [supportSpeedSwap, handleAlertAction]);

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
