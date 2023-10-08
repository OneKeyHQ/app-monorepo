import { type FC, useCallback } from 'react';

import { Box, Image, Typography } from '@onekeyhq/components';

import { openMatchDApp } from '../../Explorer/Controller/gotoSite';
import { Pressable } from '../Pressable';

type DappBannerProps = {
  title: string;
  description: string;
  image: string;
  url: string;
};

export const DappBanner: FC<DappBannerProps> = ({
  title,
  description,
  image,
  url,
}) => {
  const onPress = useCallback(() => {
    openMatchDApp({ id: url, webSite: { url, title }, isNewWindow: true });
  }, [url, title]);
  return (
    <Pressable
      onPress={onPress}
      width="320px"
      h="215px"
      borderColor="border-subdued"
      borderWidth={0.5}
      borderRadius={12}
      flexDirection="column"
      overflow="hidden"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
    >
      <Box w="full" h="140px" bg="surface-default">
        {image ? <Image src={image} width="100%" height="100%" /> : null}
      </Box>
      <Box w="full" flex="1" px="4" justifyContent="center" alignItems="center">
        <Box w="full">
          <Typography.Body1Strong numberOfLines={1}>
            {title}
          </Typography.Body1Strong>
          <Typography.Body2 color="text-subdued" numberOfLines={2}>
            {description}
          </Typography.Body2>
        </Box>
      </Box>
    </Pressable>
  );
};
