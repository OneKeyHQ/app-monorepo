/* eslint-disable camelcase */
import type { ComponentProps, FC } from 'react';
import { memo, useMemo } from 'react';

import { Box, Center, Icon, NetImage } from '@onekeyhq/components';

type Props = {
  verified?: boolean;
} & ComponentProps<typeof NetImage>;
const CollectionLogo: FC<Props> = ({ verified, ...imageProps }) => {
  const { width, height, src } = imageProps;

  const fallbackElement = useMemo(
    () => (
      <Center
        width={width}
        height={width}
        borderRadius="12px"
        bgColor="surface-neutral-subdued"
      >
        <Icon name="ImageBrokenIllus" size={20} />
      </Center>
    ),
    [width],
  );
  if (src && src.length > 0) {
    return (
      <Box width={width} height={height}>
        <NetImage
          preview={false}
          skeleton
          borderRadius="12px"
          fallbackElement={fallbackElement}
          {...imageProps}
        />
        {verified === true ? (
          <Box
            bgColor="background-default"
            position="absolute"
            right="-4px"
            bottom="-4px"
            borderRadius="full"
          >
            <Icon size={16} name="BadgeCheckMini" color="icon-success" />
          </Box>
        ) : null}
      </Box>
    );
  }
  return fallbackElement;
};
export default memo(CollectionLogo);
