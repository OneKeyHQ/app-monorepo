import React, { FC } from 'react';

import { Box, Center, Icon, Image, NetImage } from '@onekeyhq/components';
import CollectionDefaultLogo from '@onekeyhq/components/img/collection_default_logo.png';
import NFTPlaceholderBG from '@onekeyhq/components/img/NFT_placeholder_bg.png';

type Props = {
  contentType?: string | null;
  size: number;
  logoUrl?: string;
};
const FallbackElement: FC<Props> = ({ ...props }) => {
  const { contentType, size, logoUrl } = props;
  const logoSize = size * (72 / 155);

  const isMedia =
    contentType?.startsWith('audio') || contentType?.startsWith('video');

  return (
    <Center {...props} size={`${size}px`} overflow="hidden">
      <Image position="absolute" size={`${size}px`} source={NFTPlaceholderBG} />
      <Box
        size={`${logoSize}px`}
        overflow="hidden"
        borderRadius={`${logoSize / 2}px`}
      >
        <NetImage
          width={`${logoSize}px`}
          height={`${logoSize}px`}
          borderRadius={`${logoSize / 2}px`}
          src={logoUrl}
          source={logoUrl ? undefined : CollectionDefaultLogo}
        />
      </Box>
      {isMedia ? (
        <Box
          position="absolute"
          bottom={`${size * (28 / 256)}px`}
          right={`${size * (28 / 256)}px`}
        >
          <Icon
            name="PlaySolid"
            size={size * (32 / 256)}
            color="text-on-primary"
          />
        </Box>
      ) : null}
    </Center>
  );
};

export const MemoFallbackElement = React.memo(FallbackElement);
