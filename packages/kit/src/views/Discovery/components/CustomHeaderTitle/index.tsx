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
      width="100%"
      justifyContent="center"
      $md={{
        ml: -22,
        px: '$5',
        width: screenWidth,
      }}
    >
      <XStack
        role="button"
        minWidth="$64"
        $md={{
          width: '100%',
        }}
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
    </XStack>
  );
}
