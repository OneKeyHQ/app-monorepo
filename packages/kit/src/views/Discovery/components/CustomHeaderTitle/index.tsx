import { useWindowDimensions } from 'react-native';

import {
  Icon,
  Shortcut,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';

export function CustomHeaderTitle({
  handleSearchBarPress,
}: {
  handleSearchBarPress: () => void;
}) {
  const media = useMedia();
  const screenWidth = useWindowDimensions().width;

  return (
    <XStack
      role="button"
      alignItems="center"
      minWidth="$64"
      px="$2"
      py="$1.5"
      bg="$bgStrong"
      borderRadius="$3"
      $md={{
        width: screenWidth - 40,
        ml: '$-1.5',
      }}
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={handleSearchBarPress}
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
