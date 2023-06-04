import { Box, Text } from '@onekeyhq/components';

import type { InscriptionContentProps } from '../type';

type TextProps = {
  p: string;
  op: string;
  tick: string;
  amt: string;
};
// {"p":"brc-20","op":"mint","tick":"ð°","amt":"1000"}
function parseTextProps(content: string) {
  try {
    const json = JSON.parse(content) as TextProps;
    return json;
  } catch (error) {
    console.log('parse InscriptionText error = ', error);
  }
}

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
      <Text typography="CaptionMono">{prettyJson(asset.content)}</Text>

      {/* <Text typography="Body1Strong">{parseContent.tick}</Text>
      <Text typography="Body1Mono">
        {parseContent.p} <Text typography="Body1Mono">{parseContent.op}</Text>
      </Text> */}
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
      {/* <Text typography="Body1Strong">{parseContent.tick}</Text>
      <Text typography="Body1Mono">
        {parseContent.p} <Text typography="Body1Mono">{parseContent.op}</Text>
      </Text> */}
    </Box>
  );
}

export { InscriptionText, InscriptionLarge };
