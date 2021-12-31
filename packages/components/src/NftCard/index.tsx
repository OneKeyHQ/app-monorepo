import React, { isValidElement, memo, useMemo } from 'react';
import type { FC, ReactNode } from 'react';

import { Pressable } from 'native-base';

import Box from '../Box';
import Center from '../Center';
import Icon from '../Icon';
import Image from '../Image';
import { useUserDevice } from '../Provider/hooks';
import Typography from '../Typography';

import type { IPressableProps } from 'native-base';

export type CardProps = IPressableProps & {
  title?: ReactNode;
  image?: ReactNode;
};

/**
 * A NFT Card component that can be used to display a title, nft image.
 * - Should support video
 * + support local and external image
 */
const NftCard: FC<CardProps> = ({ children, image, title, ...props }) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);

  const cover = useMemo(() => {
    if (!image || typeof image !== 'string') return null;
    if (isValidElement(image)) return image;
    return (
      <Image
        source={{
          uri: image,
        }}
        alt={`image of ${typeof title === 'string' ? title : 'nft'}`}
        size={170}
        width="100%"
        fallbackElement={
          <Center>
            <Icon name="QuestionMarkOutline" size={170} />
          </Center>
        }
      />
    );
  }, [image, title]);

  return (
    <Pressable
      p="0"
      bgColor="surface-default"
      overflow="hidden"
      borderRadius="xl"
      borderWidth="2px"
      borderColor="background-hovered"
      _hover={{ bg: 'surface-hovered' }}
      _focus={{
        bg: 'surface-default',
        borderColor: 'focused-default',
      }}
      {...props}
    >
      {cover}
      <Box p={isSmallScreen ? '3' : '4'}>
        <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2>
      </Box>
    </Pressable>
  );
};

export default memo(NftCard);
