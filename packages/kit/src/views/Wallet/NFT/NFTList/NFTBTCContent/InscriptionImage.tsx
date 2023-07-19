import { Box, Image, NetImage } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionImage({ size, asset, ...props }: InscriptionContentProps) {
  const innerSize = typeof size === 'number' ? `${size}px` : (size as string);
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      size={innerSize}
      {...props}
    >
      {asset?.content && asset?.content?.length > 0 ? (
        <Image size={innerSize} source={{ uri: asset.content }} />
      ) : (
        <NetImage
          width={innerSize}
          height={innerSize}
          resizeMode="contain"
          skeleton
          src={asset.contentUrl}
        />
      )}
    </Box>
  );
}

export default InscriptionImage;
