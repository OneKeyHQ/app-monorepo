import {
  Badge,
  Icon,
  NATIVE_HIT_SLOP,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';

import type { GestureResponderEvent } from 'react-native';

function TxHistoryAddressInfo({
  address,
  badge,
}: {
  address: string;
  badge: IAddressBadge;
}) {
  const { copyText } = useClipboard();
  const { gtMd } = useMedia();
  return (
    <Popover
      placement="bottom-start"
      title={badge.label}
      renderTrigger={
        <Stack cursor="pointer">
          <SizableText
            hoverStyle={{
              color: '$text',
              size: '$bodyMdMedium',
            }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {badge.label}
          </SizableText>
        </Stack>
      }
      floatingPanelProps={{
        maxWidth: 280,
      }}
      renderContent={
        <YStack
          gap="$2"
          px="$3"
          py="$3"
          $md={{
            px: '$5',
            pt: '$2',
          }}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
          }}
        >
          <Stack
            cursor="pointer"
            testID="account-network-trigger-button"
            role="button"
            flexShrink={1}
            p="$1"
            m="$-1"
            borderRadius="$2"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusable
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }}
            hitSlop={NATIVE_HIT_SLOP}
            userSelect="none"
            onPress={(event: GestureResponderEvent) => {
              event.stopPropagation();
              copyText(address);
            }}
          >
            <SizableText size="$bodyMd">{badge.tip ?? ''}</SizableText>
          </Stack>
          {gtMd ? (
            <Stack alignSelf="flex-start">
              <Badge badgeType={badge.type} badgeSize="sm">
                <XStack gap="$1" alignItems="center" userSelect="none">
                  {badge.icon ? <Icon name={badge.icon} size="$4" /> : null}
                  <Badge.Text> {badge.label}</Badge.Text>
                </XStack>
              </Badge>
            </Stack>
          ) : null}
        </YStack>
      }
    />
  );
}

export default TxHistoryAddressInfo;
