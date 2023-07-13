import { Box, Text } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionUnknow({ size, asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      size={size}
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      bgColor="background-default"
      {...props}
    >
      <Text
        textAlign="center"
        width={size}
        typography="Body1Mono"
        numberOfLines={0}
        color="text-subdued"
      >
        {asset.content_type.toUpperCase()}
      </Text>
    </Box>
  );
}

export default InscriptionUnknow;
