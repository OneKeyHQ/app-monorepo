import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

// import type { ICheckedState } from '@onekeyhq/components';
import {
  Alert,
  // Checkbox,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
// import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import {
  ETokenRiskLevel,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

const TokenInfoCard = ({ token }: { token: ISwapToken }) => (
  <XStack space="$3" alignItems="center">
    <Token tokenImageUri={token.logoURI} />
    <YStack space="$1" flex={1}>
      <XStack space="$1" alignItems="center">
        <SizableText color="$text" size="$headingLg">
          {token.name}
        </SizableText>
        <Icon size="$5" name="InfoCircleOutline" />
      </XStack>
      <SizableText color="$textSubdued" size="$bodyMd">
        {token.symbol}
      </SizableText>
      <SizableText color="$textSubdued" size="$bodyMd">
        {token.contractAddress}
      </SizableText>
    </YStack>
  </XStack>
);

const SwapRiskReminderModal = ({
  token,
  onConfirm,
}: {
  token: ISwapToken;
  onConfirm: () => void;
}) => {
  const intl = useIntl();
  // const [checkValue, setCheckValue] = useState(false);
  // const [, setSettings] = useSettingsPersistAtom();
  const onHandleConfirm = useCallback(() => {
    // if (checkValue) {
    //   setSettings((v) => ({
    //     ...v,
    //     tokenRiskReminder: false,
    //   }));
    // }
    void backgroundApiProxy.serviceSetting.addConfirmedRiskTokens([
      `${token.networkId}_${token.contractAddress}`,
    ]);
    onConfirm();
  }, [
    // checkValue,
    onConfirm,
    // setSettings,
    token.contractAddress,
    token.networkId,
  ]);
  // const onCheckboxChange = useCallback((value: ICheckedState) => {
  //   setCheckValue(!!value);
  // }, []);

  return (
    <Page>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.token_selector_risk_reminder_title,
        })}
      />
      <Page.Body px="$5" space="$4">
        {token.riskLevel === ETokenRiskLevel.SPAM ||
        token.riskLevel === ETokenRiskLevel.MALICIOUS ? (
          <Alert
            type={
              token.riskLevel === ETokenRiskLevel.SPAM ? 'warning' : 'critical'
            }
            fullBleed
            mx="$-5"
            mt="$1"
            icon={
              token.riskLevel === ETokenRiskLevel.SPAM
                ? 'MessageExclamationOutline'
                : 'ErrorOutline'
            }
            title={intl.formatMessage({
              id:
                token.riskLevel === ETokenRiskLevel.SPAM
                  ? ETranslations.token_selector_risk_reminder_spam_token_alert
                  : ETranslations.token_selector_risk_reminder_malicious_token_alert,
            })}
          />
        ) : null}
        <TokenInfoCard token={token} />
        <Alert
          type="default"
          description={intl.formatMessage({
            id: ETranslations.token_selector_risk_reminder_message,
          })}
        />
      </Page.Body>
      <Page.Footer>
        {/* <Checkbox
          ml="$5"
          onChange={onCheckboxChange}
          value={checkValue}
          label={intl.formatMessage({
            id: ETranslations.token_selector_risk_reminder_checkbox,
          })}
        /> */}
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.token_selector_risk_reminder_button_ok,
          })}
          onCancelText={intl.formatMessage({
            id: ETranslations.token_selector_risk_reminder_button_cancel,
          })}
          onConfirm={onHandleConfirm}
          onCancel={(close) => close()}
        />
      </Page.Footer>
    </Page>
  );
};

const TokenRiskReminderModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.TokenRiskReminder>
    >();
  const { storeName, token, onConfirm } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapRiskReminderModal onConfirm={onConfirm} token={token} />
    </SwapProviderMirror>
  );
};

export default TokenRiskReminderModalWithProvider;
