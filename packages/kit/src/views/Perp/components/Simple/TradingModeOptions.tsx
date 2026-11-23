import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { useTradingLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function TradingModeOptions({
  onSelect,
}: {
  onSelect: (mode: 'simple' | 'pro') => void;
}) {
  const intl = useIntl();
  const [settings] = usePerpsCustomSettingsAtom();
  const [selectedMode, setSelectedMode] = useState<'simple' | 'pro'>(
    settings.mobileTradingMode ?? 'pro',
  );
  const [submitting] = useTradingLoadingAtom();
  const disabled = submitting;
  return (
    <YStack gap="$4">
      <YStack gap="$4" accessibilityRole="radiogroup">
        {(['simple', 'pro'] as const).map((mode) => {
          const selected = selectedMode === mode;
          const label = intl.formatMessage({
            id:
              mode === 'simple'
                ? ETranslations.perp_simple_easy__title
                : ETranslations.dexmarket_pro,
          });
          return (
            <YStack
              key={mode}
              p="$4"
              gap="$1"
              borderRadius="$3"
              borderWidth="$px"
              borderColor={selected ? '$borderActive' : '$borderSubdued'}
              cursor="default"
              hoverStyle={
                disabled
                  ? undefined
                  : {
                      borderColor: selected ? '$borderActive' : '$borderStrong',
                    }
              }
              pressStyle={
                disabled ? undefined : { borderColor: '$borderActive' }
              }
              testID={`perps-mode-dialog-${mode}`}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected, disabled }}
              opacity={disabled ? 0.5 : 1}
              onPress={() => {
                if (!disabled) setSelectedMode(mode);
              }}
            >
              <SizableText size="$headingMd" fontWeight="600">
                {label}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id:
                    mode === 'simple'
                      ? ETranslations.perp_simple_easy__desc
                      : ETranslations.perp_simple_pro__desc,
                })}
              </SizableText>
            </YStack>
          );
        })}
      </YStack>
      <Button
        testID="perps-mode-dialog-confirm"
        size="large"
        variant="primary"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onSelect(selectedMode);
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
    </YStack>
  );
}
