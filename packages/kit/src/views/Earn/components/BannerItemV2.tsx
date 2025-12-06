import { Image, SizableText, Stack } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

export function BannerItemV2({
  item,
  onPress,
}: {
  item: IDiscoveryBanner & { imgUrl?: string; titleTextProps?: any };
  onPress: (item: IDiscoveryBanner) => void;
}) {
  return (
    <Stack
      height={88}
      position="relative"
      cursor="pointer"
      onPress={() => void onPress(item)}
    >
      <Image
        source={{ uri: item.imgUrl || item.src }}
        flex={1}
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$3"
      />
      <Stack
        position="absolute"
        top={0}
        left={0}
        px="$3.5"
        py="$5"
        justifyContent="center"
      >
        {item.title?.split(/\n|\\n/).map((text, index) => (
          <SizableText
            key={index}
            lineHeight={24}
            size="$headingMd"
            color={item.theme === 'dark' ? '$textDark' : '$text'}
            numberOfLines={1}
            {...item.titleTextProps}
          >
            {text}
          </SizableText>
        ))}
      </Stack>
    </Stack>
  );
}
