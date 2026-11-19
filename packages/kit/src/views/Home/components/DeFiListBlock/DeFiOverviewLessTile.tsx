import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useOverviewTileSurfaceProps } from './DeFiOverviewTile';

import type { IDeFiOverviewTileSurface } from './DeFiOverviewTile';

export type IDeFiOverviewLessTileProps = {
  onPress: () => void;
  surface?: IDeFiOverviewTileSurface;
};

function DeFiOverviewLessTile({
  onPress,
  surface,
}: IDeFiOverviewLessTileProps) {
  const intl = useIntl();
  const surfaceProps = useOverviewTileSurfaceProps(surface, onPress);
  const collapseLabel = intl.formatMessage({
    id: ETranslations.global_collapse,
  });

  return (
    <XStack
      flex={1}
      height="100%"
      width="100%"
      bg="$bgApp"
      borderRadius="$3"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderSubdued"
      px="$3"
      py="$3"
      alignItems="center"
      gap="$3"
      cursor="pointer"
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={{ bg: surface?.hover ?? '$bgHover' }}
      pressStyle={{ bg: surface?.press ?? '$bgActive' }}
      onPress={onPress}
      role="button"
      aria-label={collapseLabel}
      {...surfaceProps}
    >
      <Stack
        width={20}
        height={20}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="ChevronTopSmallSolid" size="$5" color="$iconSubdued" />
      </Stack>
      <SizableText flex={1} minWidth={0} size="$bodyLgMedium" numberOfLines={1}>
        {collapseLabel}
      </SizableText>
    </XStack>
  );
}

export { DeFiOverviewLessTile };
