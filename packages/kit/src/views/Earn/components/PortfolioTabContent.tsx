import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

export const PortfolioTabContent = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);

  return (
    <YStack gap="$4" py="$4">
      <YStack
        gap="$4"
        p="$5"
        borderRadius="$3"
        bg="$bg"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderCurve="continuous"
        alignItems="center"
      >
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: ETranslations.earn_portfolio_details })}
        </SizableText>
        <Button onPress={onPress} variant="primary">
          {intl.formatMessage({ id: ETranslations.global_details })}
        </Button>
      </YStack>
    </YStack>
  );
};
