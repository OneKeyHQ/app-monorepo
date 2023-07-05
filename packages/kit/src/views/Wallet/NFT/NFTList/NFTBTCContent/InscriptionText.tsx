import { Box, Text } from '@onekeyhq/components';
import { parseTextProps } from '@onekeyhq/engine/src/managers/nft';

import type { InscriptionContentProps } from '../type';

function prettyJson(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch (error) {
    return content;
  }
}

function InscriptionText({ asset, ...props }: InscriptionContentProps) {
  const parseContent = parseTextProps(asset.content);
  if (!parseContent) {
    return null;
  }
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      bgColor="background-default"
      paddingX="8px"
      {...props}
    >
      {/* <Text typography="CaptionMono">{prettyJson(asset.content)}</Text> */}

      <Text typography="DisplayLarge">{parseContent.tick}</Text>
      <Text typography="Body2Mono">
        {parseContent.p} <Text typography="Body2Mono">{parseContent.op}</Text>
      </Text>
    </Box>
  );
}

function InscriptionLarge({ asset, ...props }: InscriptionContentProps) {
  const parseContent = parseTextProps(asset.content);
  if (!parseContent) {
    return null;
  }
  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      {...props}
    >
      <Text typography="Body1Mono">{prettyJson(asset.content)}</Text>
    </Box>
  );
}

export { InscriptionText, InscriptionLarge };
