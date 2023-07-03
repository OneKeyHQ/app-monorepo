import { Box, Image } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionImage({ size, asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      {...props}
    >
      <Image size={size} source={{ uri: asset.content }} />
    </Box>
  );
}

export default InscriptionImage;
