import { useIntl } from 'react-intl';
import Svg, { G, Path } from 'react-native-svg';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsRecallIllustration } from './PerpsRecallIllustration';

export function PerpsRecallDesktopHint({
  webDapp = false,
}: {
  webDapp?: boolean;
}) {
  const intl = useIntl();
  const theme = useTheme();
  return (
    <Stack width="100%" height={webDapp ? 224 : 196}>
      <Stack position="absolute" top={56} left={0} right={0} height={140}>
        <Svg width="100%" height="100%" viewBox="0 0 360 140">
          <G stroke={theme.bgAccent.val} opacity={0.2}>
            <Path
              d="M24 110V130M48 98V116M72 77V99M96 67V85M132 62V85M156 39V66M180 22V47M204 14V36"
              strokeWidth={1}
            />
            <Path
              d="M24 116V124M48 104V110M72 82V92M96 72V80M132 68V78M156 46V58M180 28V39M204 19V29"
              strokeWidth={6}
            />
          </G>
          <G stroke={theme.textCritical.val} opacity={0.16}>
            <Path
              d="M36 110V128M60 96V119M84 76V97M108 73V99M120 78V100M144 60V84M168 37V63M192 24V42"
              strokeWidth={1}
            />
            <Path
              d="M36 115V121M60 101V111M84 82V90M108 79V91M120 84V94M144 66V76M168 42V55M192 29V36"
              strokeWidth={6}
            />
          </G>
        </Svg>
      </Stack>
      <XStack
        height={56}
        px="$3"
        gap="$2"
        alignItems="center"
        borderBottomWidth={1}
        borderColor="$borderDisabled"
      >
        <SizableText size="$headingLg" flex={1} color="$textSubdued">
          OneKey
        </SizableText>
        {webDapp ? (
          <XStack
            height={32}
            pl="$2"
            pr="$1"
            gap="$2"
            alignItems="center"
            bg="$bgStrong"
            borderRadius="$full"
          >
            <Stack
              width={20}
              height={20}
              bg="$borderSubdued"
              borderRadius="$full"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              0x···
            </SizableText>
            <Stack
              px="$2"
              height={26}
              justifyContent="center"
              bg="$neutral4"
              borderRadius="$full"
            >
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            </Stack>
          </XStack>
        ) : (
          <>
            <XStack
              height={30}
              px="$3"
              gap="$2"
              alignItems="center"
              bg="$bgStrong"
              borderWidth={1}
              borderColor="$transparent"
              borderRadius="$full"
            >
              <Icon name="ChartLine2Outline" size="$4" />
              <SizableText size="$bodySmMedium" color="$textSubdued">
                --
              </SizableText>
            </XStack>
            <Stack
              width={28}
              height={28}
              alignItems="center"
              justifyContent="center"
              bg="$bgHover"
              borderRadius="$full"
            >
              <Icon name="DotHorOutline" size="$5" color="$iconSubdued" />
            </Stack>
          </>
        )}
      </XStack>
      <YStack
        position="absolute"
        top={50}
        right={12}
        width="64%"
        minWidth={200}
        p="$1.5"
        gap="$1"
        bg="$bg"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        {[72, 92].map((width) => (
          <XStack
            key={width}
            height={28}
            px="$2"
            gap="$3"
            alignItems="center"
            opacity={0.6}
          >
            <Stack
              width={14}
              height={14}
              borderRadius="$1"
              bg="$borderSubdued"
            />
            <Stack
              width={width}
              height={6}
              borderRadius="$full"
              bg="$borderSubdued"
            />
          </XStack>
        ))}
        {webDapp ? (
          <YStack
            gap="$2"
            pt="$2"
            borderTopWidth={1}
            borderColor="$borderDisabled"
          >
            <XStack px="$2" gap="$3" alignItems="center">
              <Stack
                flex={1}
                height={6}
                bg="$borderSubdued"
                borderRadius="$full"
              />
              <Stack
                width={32}
                height={32}
                alignItems="center"
                justifyContent="center"
                bg="$brand3"
                borderRadius="$full"
              >
                <Icon name="GiftOutline" size="$5" />
              </Stack>
              <Icon name="BookOpenOutline" size="$4" color="$iconSubdued" />
              <Icon name="HelpSupportOutline" size="$4" color="$iconSubdued" />
              <Icon name="SettingsOutline" size="$4" color="$iconSubdued" />
            </XStack>
            <SizableText size="$bodySmMedium" textAlign="center" pb="$1">
              {intl.formatMessage({ id: ETranslations.perps_activity_hub })}
            </SizableText>
          </YStack>
        ) : (
          <XStack
            gap="$2"
            p="$2"
            alignItems="center"
            bg="$bgStrong"
            borderRadius="$2"
          >
            <Stack
              width="$8"
              height="$8"
              borderRadius="$full"
              bg="$brand3"
              alignItems="center"
              justifyContent="center"
            >
              <Stack width={26} height={23}>
                <PerpsRecallIllustration trimmed />
              </Stack>
            </Stack>
            <SizableText size="$bodySmMedium" flex={1}>
              {intl.formatMessage({ id: ETranslations.perps_recall__title })}
            </SizableText>
            <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
          </XStack>
        )}
      </YStack>
      <Stack
        position="absolute"
        right={webDapp ? 68 : 5}
        top={32}
        width={22}
        height={28}
      >
        <Svg width={22} height={28} viewBox="0 0 22 28">
          <Path
            d="M2 2L19 14L11 15L15 24L11 26L7 17L2 23Z"
            fill={theme.text.val}
            stroke={theme.bg.val}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
      </Stack>
    </Stack>
  );
}
