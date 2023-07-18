import { Box, Image, NetImage } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionImage({ size, asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      size={size}
      {...props}
    >
      {asset?.content && asset?.content?.length > 0 ? (
        <Image size={size} source={{ uri: asset.content }} />
      ) : (
        <NetImage
          width={`${Number(size)}px`}
          height={`${Number(size)}px`}
          resizeMode="contain"
          skeleton
          src={asset.contentUrl}
        />
      )}
    </Box>
  );
}

export default InscriptionImage;
