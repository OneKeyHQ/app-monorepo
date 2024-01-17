import {
  Icon,
  Shortcut,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';

export function CustomHeaderTitle() {
  const media = useMedia();

  return (
    <XStack
      role="button"
      // w="100%"
      minWidth="$64"
      px="$2"
      py="$1.5"
      alignItems="center"
      bg="$bgStrong"
      borderRadius="$3"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      style={{
        borderCurve: 'continuous',
      }}
    >
      <Icon name="SearchOutline" size="$5" color="$iconSubdued" />
      <SizableText pl="$2" size="$bodyLg" color="$textSubdued" flex={1}>
        Search
      </SizableText>
      {media.gtMd && (
        <Shortcut>
          <Shortcut.Key>/</Shortcut.Key>
        </Shortcut>
      )}
    </XStack>
  );
}
