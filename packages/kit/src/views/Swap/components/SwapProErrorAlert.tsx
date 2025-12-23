import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { HyperlinkText } from '../../../components/HyperlinkText';
import { useSwapTypeSwitchAtom } from '../../../states/jotai/contexts/swap';

interface ISwapProErrorAlertProps {
  title?: string;
  message?: string;
  isNative?: boolean;
}

const SwapProErrorAlert = ({
  title,
  message,
  isNative,
}: ISwapProErrorAlertProps) => {
  const intl = useIntl();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const handleAlertAction = useCallback(
    (actionName: string) => {
      if (actionName === 'Swap') {
        void setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
      } else if (actionName === 'Bridge') {
        void setSwapTypeSwitch(ESwapTabSwitchType.BRIDGE);
      }
    },
    [setSwapTypeSwitch],
  );
  const titleValue = useMemo(() => {
    if (isNative) {
      return intl.formatMessage({
        id: ETranslations.promode_swap_unsupported_title,
      });
    }
    return title;
  }, [isNative, intl, title]);
  const messageComponent = useMemo(() => {
    if (isNative) {
      return (
        <HyperlinkText
          size="$bodyMd"
          color="$textSubdued"
          translationId={ETranslations.promode_swap_unsupported_message}
          onAction={(actionName) => {
            void handleAlertAction(actionName);
          }}
          values={{
            Swap: (
              <SizableText size="$bodyMd">
                {intl.formatMessage({
                  id: ETranslations.global_swap,
                })}
              </SizableText>
            ),
            Bridge: (
              <SizableText size="$bodyMd">
                {intl.formatMessage({
                  id: ETranslations.swap_page_bridge,
                })}
              </SizableText>
            ),
          }}
        />
      );
    }
    return undefined;
  }, [isNative, intl, handleAlertAction]);

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
