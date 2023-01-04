import { isValidElement, memo, useMemo } from 'react';
import type { FC, ReactNode } from 'react';

import { useWindowDimensions } from 'react-native';

import { useUserDevice } from '@onekeyhq/components';

import Box from '../Box';
import Center from '../Center';
import Icon from '../Icon';
import Image from '../Image';
import Pressable from '../Pressable';
import Typography from '../Typography';

import type { IPressableProps } from 'native-base';

export type CardProps = IPressableProps & {
  title?: ReactNode;
  image?: ReactNode;
};

const MARGIN = 16;

/**
 * A NFT Card component that can be used to display a title, nft image.
 * - Should support video
 * + support local and external image
 */
const NftCard: FC<CardProps> = ({ children, image, title, ...props }) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const dimensions = useWindowDimensions();
  const width = isSmallScreen
    ? Math.floor((dimensions.width - MARGIN * 3) / 2)
    : 171;

  const fallbackElement = useMemo(
    () => (
      <Center width={width} height={width} bgColor="surface-neutral-subdued">
        <Icon name="QuestionMarkCircleOutline" size={36} />
      </Center>
    ),
    [width],
  );
  const cover = useMemo(() => {
    if (!image || typeof image !== 'string') return fallbackElement;
    if (isValidElement(image)) return image;
    return (
      <Image
        source={{
          uri: image,
        }}
        alt={`image of ${typeof title === 'string' ? title : 'nft'}`}
        size={width}
        bgColor="surface-neutral-subdued"
        fallbackElement={fallbackElement}
      />
    );
  }, [fallbackElement, image, title, width]);

  return (
    <Pressable.Item
      px={0}
      py={0}
      overflow="hidden"
      borderRadius="xl"
      borderWidth={0}
      width={width}
      {...props}
    >
      {cover}
      <Box p={isSmallScreen ? '3' : '4'}>
        <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2>
      </Box>
    </Pressable.Item>
  );
};

export default memo(NftCard);
