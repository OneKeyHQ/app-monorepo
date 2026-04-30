import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

export type IDeFiOverviewMoreTileProps = {
  extraProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  extraCount: number;
  onPress: () => void;
};

function DeFiOverviewMoreTile({
  extraProtocols,
  protocolMap,
  extraCount,
  onPress,
}: IDeFiOverviewMoreTileProps) {
  const intl = useIntl();

  const moreLabel = intl.formatMessage({ id: ETranslations.global_more });
  const protocolWord = intl.formatMessage({
    id: ETranslations.global_protocol,
  });
  const viewMoreLabel = intl.formatMessage({
    id: ETranslations.global_view_more,
  });

  return (
    <XStack
      flex={1}
      bg="$bgApp"
      borderRadius="$3"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderSubdued"
      px="$4"
      py="$3.5"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="pointer"
      onPress={onPress}
      role="button"
      aria-label={`${viewMoreLabel} (+${extraCount})`}
    >
      <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
        <Stack position="relative" width={44} height={24} flexShrink={0}>
          {extraProtocols.map((p, i) => {
            const key = defiUtils.buildProtocolMapKey({
              protocol: p.protocol,
              networkId: p.networkId,
            });
            const info = protocolMap[key];
            return (
              <Stack
                key={key}
                position="absolute"
                left={i * 10}
                top={0}
                width={24}
                height={24}
                borderRadius="$full"
                borderWidth={2}
                borderColor="$bgApp"
                overflow="hidden"
                bg="$bgApp"
              >
                <Token size="xs" tokenImageUri={info?.protocolLogo} />
              </Stack>
            );
          })}
        </Stack>
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {moreLabel}
          </SizableText>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {`+${extraCount} ${protocolWord}`}
          </SizableText>
        </YStack>
      </XStack>
      <Stack
        width={20}
        height={20}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="ChevronRightSmallSolid" size="$5" color="$iconSubdued" />
      </Stack>
    </XStack>
  );
}

export { DeFiOverviewMoreTile };
