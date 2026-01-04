import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IEarnHomeMode = 'earn' | 'borrow';

export const EarnHomeTabs = ({
  earn,
  borrow,
  defaultMode = 'earn',
  onModeChange,
}: {
  earn: React.ReactNode;
  borrow: React.ReactNode;
  defaultMode?: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
}) => {
  const intl = useIntl();
  const activeMode = defaultMode;

  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.earn_title }),
        value: 'earn' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_borrow }),
        value: 'borrow' as const,
      },
    ],
    [intl],
  );

  return (
    <YStack flex={1} pt="$2">
      <Stack px="$5">
        <SegmentControl
          value={activeMode}
          options={options}
          onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        />
      </Stack>
      {/* Conditional rendering to avoid Tabs context issues */}
      <Stack flex={1} pt="$6">
        {activeMode === 'earn' ? earn : borrow}
      </Stack>
    </YStack>
  );
};
