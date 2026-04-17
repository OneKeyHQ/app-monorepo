import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLanguageSelectorWithoutAuto } from '../../Setting/hooks/useLanguageSelector';

// Electron drag-region helpers. On desktop, the header container is a window
// drag handle; interactive children opt out so they remain clickable.
const DRAG_STYLE = (
  platformEnv.isDesktop ? { WebkitAppRegion: 'drag' } : undefined
) as any;

const NO_DRAG_STYLE = (
  platformEnv.isDesktop ? { WebkitAppRegion: 'no-drag' } : undefined
) as any;

export const LayoutHeader = memo(
  ({ children, style, ...rest }: IXStackProps) => {
    const { top } = useSafeAreaInsets();
    return (
      <YStack pt={top || '$12'}>
        <XStack
          h={52}
          px="$5"
          alignItems="center"
          $gtMd={{
            px: '$12',
          }}
          {...rest}
          style={[DRAG_STYLE, style]}
        >
          {children}
        </XStack>
      </YStack>
    );
  },
);
LayoutHeader.displayName = 'LayoutHeader';

export const LayoutHeaderBack = memo(({ exit }: { exit?: boolean }) => {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  const icon = exit ? 'CrossedLargeOutline' : 'ArrowLeftOutline';

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  return (
    <IconButton
      size={gtMd ? 'small' : 'medium'}
      icon={icon}
      variant="tertiary"
      onPress={handleBack}
      zIndex={1}
      style={NO_DRAG_STYLE}
    />
  );
});
LayoutHeaderBack.displayName = 'LayoutHeaderBack';

export const LayoutHeaderTitle = memo(
  ({ children }: { children: React.ReactNode }) => (
    <YStack
      position="absolute"
      inset={0}
      zIndex={0}
      justifyContent="center"
      alignItems="center"
    >
      <SizableText size="$headingLg" textAlign="center">
        {children}
      </SizableText>
    </YStack>
  ),
);
LayoutHeaderTitle.displayName = 'LayoutHeaderTitle';

export const LayoutHeaderLanguageSelector = memo(() => {
  const intl = useIntl();
  const { options, value, onChange } = useLanguageSelectorWithoutAuto();
  const { gtMd } = useMedia();

  const handleLanguageChange = useCallback(
    (v: string) => {
      setTimeout(() => {
        void onChange(v);
      }, 350);
    },
    [onChange],
  );

  return (
    <YStack ml="auto" style={NO_DRAG_STYLE}>
      <Select
        offset={{ mainAxis: 8, crossAxis: 8 }}
        title={intl.formatMessage({ id: ETranslations.global_language })}
        items={options}
        value={value}
        onChange={handleLanguageChange}
        placement="bottom-end"
        floatingPanelProps={{ maxHeight: 280 }}
        sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
        renderTrigger={({ label }) =>
          gtMd ? (
            <Button
              size="small"
              icon="GlobusOutline"
              variant="tertiary"
              ml="auto"
            >
              {label}
            </Button>
          ) : (
            <IconButton icon="GlobusOutline" variant="tertiary" ml="auto" />
          )
        }
      />
    </YStack>
  );
});
LayoutHeaderLanguageSelector.displayName = 'LayoutHeaderLanguageSelector';
