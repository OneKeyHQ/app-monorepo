import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IDustSweepCandidate } from '../stateMachine';

export function DustSweepSummaryCard({
  targetToken,
  selectedCount,
  selectedFiatValue,
  slippage,
  onChangeSlippage,
  onStart,
  disabled,
  desktop,
}: {
  targetToken?: IDustSweepCandidate;
  selectedCount: number;
  selectedFiatValue: string;
  slippage: number;
  onChangeSlippage: () => void;
  onStart: () => void;
  disabled: boolean;
  desktop: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack
      gap="$4"
      p="$5"
      borderRadius={desktop ? '$5' : '$0'}
      borderWidth={desktop ? 1 : 0}
      borderColor="$borderSubdued"
      borderTopWidth={desktop ? 1 : 1}
      bg="$bg"
      flex={desktop ? 1 : undefined}
    >
      <SizableText color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.sweep_you_receive })}
      </SizableText>
      <XStack alignItems="center" gap="$3">
        <Token
          size="md"
          tokenImageUri={targetToken?.logoURI}
          networkId={targetToken?.networkId}
          showNetworkIcon
        />
        <SizableText flex={1} size="$bodyLgMedium">
          {targetToken?.symbol ?? '—'}
        </SizableText>
        <YStack alignItems="flex-end" gap="$1">
          <SizableText>—</SizableText>
          <SizableText color="$textSubdued">—</SizableText>
        </YStack>
      </XStack>
      <Divider />
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.provider_title })}
        </SizableText>
        <XStack alignItems="center" gap="$2">
          <Stack
            width="$5"
            height="$5"
            borderRadius="$2"
            bg="$bgStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name="GlobusOutline" size="$4" color="$iconSubdued" />
          </Stack>
          <SizableText>OKX</SizableText>
        </XStack>
      </XStack>
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_slippage_tolerance,
          })}
        </SizableText>
        <Button
          testID="dust-sweep-slippage"
          size="small"
          variant="tertiary"
          onPress={onChangeSlippage}
        >
          {intl.formatMessage(
            { id: ETranslations.swap_page_provider_slippage_auto },
            { number: slippage },
          )}
        </Button>
      </XStack>
      <Button
        testID="dust-sweep-submit"
        onPress={onStart}
        disabled={disabled}
        mt={desktop ? 'auto' : '$1'}
      >
        {intl.formatMessage({ id: ETranslations.sweep_sweep })} {selectedCount}{' '}
        {intl.formatMessage({ id: ETranslations.tokens__title })}
        {selectedFiatValue ? ` (~$${selectedFiatValue})` : ''}
      </Button>
    </YStack>
  );
}
