import { IconButton, XStack } from '@onekeyhq/components';

export const TRADES_HISTORY_SHARE_ACTION_WIDTH = 32;

export function TradesHistoryShareAction({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      width={TRADES_HISTORY_SHARE_ACTION_WIDTH}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
    >
      {visible ? (
        <IconButton
          testID="perp-icon-btn"
          variant="tertiary"
          size="medium"
          icon="ShareOutline"
          iconSize="$4"
          iconProps={{ color: '$iconSubdued' }}
          hoverStyle={null}
          pressStyle={null}
          onPress={onPress}
          hotKey
        />
      ) : null}
    </XStack>
  );
}
