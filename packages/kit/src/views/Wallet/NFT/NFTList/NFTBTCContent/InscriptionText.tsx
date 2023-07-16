import { Box, Center, Text } from '@onekeyhq/components';
import { parseTextProps } from '@onekeyhq/engine/src/managers/nft';

import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

function prettyJson(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch (error) {
    return content;
  }
}

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
      >
        {asset.content}
      </Text>
    </Box>
  );
}

function InscriptionLarge({ asset, ...props }: InscriptionContentProps) {
  const parseContent = parseTextProps(asset.content);
  if (!parseContent) {
    return <InscriptionUnknow asset={asset} {...props} />;
  }
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
