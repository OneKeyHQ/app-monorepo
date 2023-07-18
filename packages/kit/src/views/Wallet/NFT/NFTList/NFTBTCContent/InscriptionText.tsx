import { Box, Text } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

function InscriptionText({ asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      bgColor="background-default"
      paddingX="4px"
      {...props}
    >
      <Text
        numberOfLines={8}
        width={Number(props.size) - 8}
        typography="CaptionMono"
        color="text-subdued"
        textAlign="center"
      >
        {asset.content}
      </Text>
    </Box>
  );
}

function InscriptionLarge({ asset, ...props }: InscriptionContentProps) {
  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      {...props}
    >
      <Text numberOfLines={10} width={180} typography="CaptionMono">
        {asset.content}
      </Text>
    </Box>
  );
}

export { InscriptionText, InscriptionLarge };
