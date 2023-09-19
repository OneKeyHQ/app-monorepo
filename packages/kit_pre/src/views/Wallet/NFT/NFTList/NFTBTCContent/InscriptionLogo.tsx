import { Box } from '@onekeyhq/components';

import OrdinalsSVG from '../../../../../components/SVG/OrdinalsSVG';

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
      <OrdinalsSVG width={40} height={40} />
    </Box>
  );
}

export default InscriptionLogo;
