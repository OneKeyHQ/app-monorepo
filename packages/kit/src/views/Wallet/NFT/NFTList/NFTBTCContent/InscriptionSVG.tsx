import { Box } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionSVG({ size, asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      size={size}
      {...props}
    >
      <iframe
        title="iframe-web"
        src={asset.contentUrl}
        frameBorder="0"
        style={{ height: '100%', width: '100%' }}
      />
    </Box>
  );
}

export default InscriptionSVG;
