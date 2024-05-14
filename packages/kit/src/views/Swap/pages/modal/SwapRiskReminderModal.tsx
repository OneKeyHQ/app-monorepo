import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Alert,
  Checkbox,
  //   type IPageNavigationProp,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
// import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

const TokenInfoCard = ({ token }: { token: ISwapToken }) => (
  <XStack space="$3">
    <Token tokenImageUri={token.logoURI} />
    <YStack space="$1">
      <XStack space="$1">
        <SizableText color="$text" size="$headingLg">
          {token.name}
        </SizableText>
        <Icon name="MessageExclamationOutline" />
      </XStack>
      <SizableText color="$textSubdued" size="$bodyMd">
        {token.symbol}
      </SizableText>
      <SizableText color="$textSubdued" numberOfLines={2} size="$bodyMd">
        {token.contractAddress}
      </SizableText>
    </YStack>
  </XStack>
);

const SwapRiskReminderModal = ({ token }: { token: ISwapToken }) => {
  //   const navigation =
  //     useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const onConfirm = useCallback(() => {}, []);
  return (
    <Page>
      <Page.Header headerTitle="Risk reminder" />
      <Page.Body>
        <Alert
          type="warning"
          fullBleed
          icon="MessageExclamationOutline"
          title="Suspected spam token."
          action={{ primary: 'View', onPrimaryPress: () => {} }}
        />
        <TokenInfoCard token={token} />
        <Alert
          type="default"
          description="Anyone can issue tokens, including counterfeit tokens under valid projects. User who bought counterfeit tokens might not be able to sell them, resulting in asset loss. If you proceed to trade this custom token, you’ll be liable to all potential risk and responsibilities."
        />
      </Page.Body>
      <Page.Footer>
        <Checkbox label="Don't show this alert for all non-verified tokens" />
        <Page.FooterActions
          onConfirmText="OK"
          onCancelText="Cancel"
          onConfirm={onConfirm}
          onCancel={(close) => close()}
        />
      </Page.Footer>
    </Page>
  );
};

const SwapRiskReminderModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapRiskReminder>
    >();
  const { storeName, token } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapRiskReminderModal token={token} />
    </SwapProviderMirror>
  );
};

export default SwapRiskReminderModalWithProvider;
