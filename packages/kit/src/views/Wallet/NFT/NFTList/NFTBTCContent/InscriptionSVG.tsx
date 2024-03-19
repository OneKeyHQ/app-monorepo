import { useCallback } from 'react';

import { Box, Image } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

function InscriptionSVG({ size, asset, ...props }: InscriptionContentProps) {
  const innerSize = typeof size === 'number' ? `${size}px` : (size as string);

  const renderSVG = useCallback(() => {
    if (asset?.content && asset?.content?.length > 0) {
      return <Image size={innerSize} source={{ uri: asset.content }} />;
    }

    if (platformEnv.isNative) {
      return <InscriptionUnknow size={size} asset={asset} {...props} />;
    }

    return (
      <iframe
        title="iframe-web"
        src={asset.contentUrl}
        frameBorder="0"
        style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
      />
    );
  }, [asset, innerSize, size]);

  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      size={innerSize}
      {...props}
    >
      {renderSVG()}
    </Box>
  );
}

export default InscriptionSVG;
