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
      <Text width={size} typography="Body1Strong" numberOfLines={0}>
        {asset.content_type}
      </Text>
    </Box>
  );
}

export default InscriptionUnknow;
