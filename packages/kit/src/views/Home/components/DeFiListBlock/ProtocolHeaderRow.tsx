import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { formatPortfolioTotal } from './formatPortfolioTotal';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

// Mirrors the DeFi detail page: open the protocol's site in the in-app
// discovery browser on desktop/native, or a new tab on web.
function openProtocolUrl(url: string) {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    openUrlInDiscovery({ url });
  } else {
    openUrlExternal(url);
  }
}

export type IProtocolHeaderRowProps = {
  name: string;
  logo?: string;
  networkId: string;
  currencySymbol: string;
  netWorth: number | string;
  isAllNetworks?: boolean;
  positionCountText?: string;
  open?: boolean;
  // Protocol site URL. When present, a jump-link icon renders to the right of
  // the name; omitted → no icon.
  protocolUrl?: string;
};

function ProtocolHeaderRow({
  name,
  logo,
  networkId,
  currencySymbol,
  netWorth,
  isAllNetworks,
  positionCountText,
  open = true,
  protocolUrl,
}: IProtocolHeaderRowProps) {
  const intl = useIntl();
  const [settingsValue] = useSettingsValuePersistAtom();
  const formattedNetWorth = formatPortfolioTotal(
    Number(netWorth) || 0,
    currencySymbol,
    settingsValue.hideValue,
  );

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      px="$5"
      py="$3"
      bg="$bgSubdued"
      // Top corners follow the parent card's $3 radius; bottom is square
      // because the category groups continue directly below this row.
      borderTopLeftRadius="$3"
      borderTopRightRadius="$3"
      borderCurve="continuous"
    >
      <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logo}
          showNetworkIcon={isAllNetworks}
          networkId={networkId}
        />
        <YStack flex={1} minWidth={0} alignItems="flex-start">
          <XStack alignItems="center" gap="$1" maxWidth="100%" minWidth={0}>
            <SizableText
              size="$headingLg"
              numberOfLines={1}
              color="$text"
              flexShrink={1}
              minWidth={0}
            >
              {name}
            </SizableText>
            {protocolUrl ? (
              <Stack
                testID="defi-protocol-header-link"
                role="button"
                aria-label={intl.formatMessage({
                  id: ETranslations.global_view_in_blockchain_explorer,
                })}
                focusable
                flexShrink={0}
                cursor="pointer"
                p="$1"
                borderRadius="$2"
                borderCurve="continuous"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                focusVisibleStyle={{
                  outlineColor: '$focusRing',
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineOffset: 1,
                }}
                onPress={(event) => {
                  // The header is an Accordion.Trigger (a native <button>): stop
                  // the press so opening the link doesn't toggle the accordion,
                  // and keep this a div-based pressable rather than nesting a
                  // real <button> (IconButton) inside the trigger button.
                  event.stopPropagation();
                  openProtocolUrl(protocolUrl);
                }}
              >
                <Icon name="OpenOutline" size="$5" color="$iconSubdued" />
              </Stack>
            ) : null}
          </XStack>
          {positionCountText ? (
            <SizableText
              size="$bodyMd"
              numberOfLines={1}
              color="$textSubdued"
              pointerEvents="none"
            >
              {positionCountText}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <SizableText
        size="$headingLg"
        numberOfLines={1}
        textAlign="right"
        minWidth={120}
        maxWidth={168}
        color="$text"
        fontVariant={TABULAR_NUMS}
      >
        {formattedNetWorth}
      </SizableText>
      <View
        ml="$3"
        animation="quick"
        rotate={open ? '180deg' : '0deg'}
        transformOrigin="center"
      >
        <Icon name="ChevronDownSmallSolid" color="$iconSubdued" size="$6" />
      </View>
    </Stack>
  );
}

export { ProtocolHeaderRow };
