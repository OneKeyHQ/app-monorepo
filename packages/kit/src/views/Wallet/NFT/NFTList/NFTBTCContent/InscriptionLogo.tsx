import { Box, Image } from '@onekeyhq/components';
import OrdinalLogo from '@onekeyhq/kit/assets/Ordinal.png';

import type { InscriptionContentProps } from '../type';

function InscriptionLogo({ size, asset, ...props }: InscriptionContentProps) {
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
      <Image source={OrdinalLogo} size="40px" />
    </Box>
  );
}

export default InscriptionLogo;
