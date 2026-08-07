// cspell:ignore DEFILLAMA
import { Icon, Image, XStack } from '@onekeyhq/components';

// Official DeFiLlama favicon: https://defillama.com/favicon-badge.png
// Embedded so the protocol list remains available offline.
const DEFILLAMA_ICON_DATA_URI =
  'data:image/png;base64,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';

export function CustomInjectedProtocolSourceIcon({
  active = false,
  size = 14,
  source,
  testID,
}: {
  active?: boolean;
  size?: number;
  source: string;
  testID?: string;
}) {
  let sourceLabel = source;
  if (source === 'defillama') {
    sourceLabel = 'DeFiLlama';
  } else if (source === 'custom') {
    sourceLabel = 'Custom';
  }
  return (
    <XStack
      alignItems="center"
      aria-label={`${sourceLabel} source`}
      h={size}
      justifyContent="center"
      role="img"
      testID={testID}
      w={size}
    >
      {source === 'defillama' ? (
        <Image h={size} source={{ uri: DEFILLAMA_ICON_DATA_URI }} w={size} />
      ) : (
        <Icon
          color={active ? '$iconInfo' : '$iconSubdued'}
          name="ToolboxOutline"
          size={size}
        />
      )}
    </XStack>
  );
}
