import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Skeleton, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { normalizeEModeLabel } from '../pages/BorrowEModeSwitch/emodeUtils';
import { BorrowTestIDs } from '../testIDs';

import { OverviewMetric } from './OverviewMetric';

import type { IOverviewMetricProps } from './OverviewMetric';

export function BorrowEModeMetric({
  eModeStatus,
  isError = false,
  isLoading = false,
  widthMode,
  variant = 'metric',
}: {
  eModeStatus?: IBorrowEModeStatus | null;
  isError?: boolean;
  isLoading?: boolean;
  widthMode?: IOverviewMetricProps['widthMode'];
  variant?: 'metric' | 'bar';
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { market, earnAccount } = useBorrowContext();

  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountData = earnAccount.data;
  const earnAccountId = getBorrowEarnAccountId(earnAccountData);

  const currentEMode = eModeStatus?.categories?.find(
    (c) => c.eModeId === eModeStatus.eModeId,
  );
  const hasEMode = (eModeStatus?.categories?.length ?? 0) > 0;
  const showError = isError && !eModeStatus;
  const showInitialLoading = isLoading && !eModeStatus && !showError;
  const showPlaceholder = showInitialLoading || showError;

  const openEModeSwitch = useCallback(() => {
    if (!networkId || !provider || !marketAddress || !earnAccountId) {
      return;
    }
    BorrowNavigation.pushToBorrowEModeSwitch(navigation, {
      accountId: earnAccountId,
      indexedAccountId: earnAccountData?.account?.indexedAccountId,
      networkId,
      provider,
      marketAddress,
    });
  }, [
    earnAccountData?.account?.indexedAccountId,
    earnAccountId,
    marketAddress,
    navigation,
    networkId,
    provider,
  ]);

  if (!hasEMode && !showPlaceholder) {
    return null;
  }

  const resolveValueText = () => {
    if (showError) {
      return '-';
    }
    if (eModeStatus?.eModeId !== 0 && currentEMode) {
      return normalizeEModeLabel(currentEMode.label);
    }
    return intl.formatMessage({ id: ETranslations.defi_emode_off });
  };
  const valueText = resolveValueText();
  const title = intl.formatMessage({ id: ETranslations.defi_emode_title });
  const chevron = (
    <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
  );
  const chevronSlot = showPlaceholder ? <XStack w="$5" h="$5" /> : chevron;
  const renderBarValue = () => {
    if (showInitialLoading) {
      return (
        <XStack testID={`${BorrowTestIDs.overviewEModeCell}-loading`}>
          <Skeleton w={72} h="$6" borderRadius="$1" />
        </XStack>
      );
    }
    return (
      <SizableText
        size="$bodyLgMedium"
        color="$textSubdued"
        numberOfLines={1}
        flexShrink={1}
      >
        {valueText}
      </SizableText>
    );
  };

  if (variant === 'bar') {
    return (
      <XStack
        testID={BorrowTestIDs.overviewEModeCell}
        ai="center"
        gap="$2"
        width="100%"
        bg="$bgSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        px="$4"
        py="$3"
        {...(!showPlaceholder && {
          onPress: openEModeSwitch,
          cursor: 'pointer',
          hoverStyle: { bg: '$bgHover' },
          pressStyle: { bg: '$bgActive' },
        })}
      >
        <SizableText size="$bodyLgMedium" flex={1} numberOfLines={1}>
          {title}
        </SizableText>
        {renderBarValue()}
        {chevronSlot}
      </XStack>
    );
  }

  return (
    <OverviewMetric
      testID={BorrowTestIDs.overviewEModeCell}
      title={{ text: title }}
      text={{ text: valueText }}
      isLoading={showInitialLoading}
      onPress={showPlaceholder ? undefined : openEModeSwitch}
      widthMode={widthMode}
      action={showPlaceholder ? undefined : chevron}
    />
  );
}
