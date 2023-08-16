import { Box } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionSVG({ size, asset, ...props }: InscriptionContentProps) {
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
      <iframe
        title="iframe-web"
        src={asset.contentUrl}
        frameBorder="0"
        style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
      />
    </Box>
  );
}

export default InscriptionSVG;
