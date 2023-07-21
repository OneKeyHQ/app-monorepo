import { useEffect, useState } from 'react';

import axios from 'axios';
import safeStringify from 'json-stringify-safe';
import { isNil, isString } from 'lodash';

import { Box, Text } from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

function useTestnetRemoteTextContent({ asset }: { asset: NFTBTCAssetModel }) {
  const [content, setContent] = useState<string>('');
  const { contentUrl, networkId } = asset;

  useEffect(() => {
    const isUrl =
      contentUrl &&
      (contentUrl?.startsWith('http://') || contentUrl?.startsWith('https://'));
    if (networkId === OnekeyNetwork.tbtc && isUrl && contentUrl) {
      axios.get(contentUrl).then((res) => {
        const { data } = res;
        if (!isNil(data)) {
          setContent(isString(data) ? data : safeStringify(data));
        }
      });
    }
  }, [contentUrl, networkId]);
  return content;
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
        textAlign="center"
      >
        {asset.content}
      </Text>
    </Box>
  );
}

function InscriptionTextTestnet(props: InscriptionContentProps) {
  const { asset } = props;
  const content = useTestnetRemoteTextContent({ asset });
  if (content) {
    asset.content = content;
    return <InscriptionText {...props} />;
  }
  return <InscriptionUnknow {...props} />;
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

function InscriptionLargeTestnet(props: InscriptionContentProps) {
  const { asset } = props;
  const content = useTestnetRemoteTextContent({ asset });
  if (content) {
    asset.content = content;
    return <InscriptionLarge {...props} />;
  }
  return <InscriptionUnknow {...props} />;
}

export {
  InscriptionText,
  InscriptionLarge,
  InscriptionTextTestnet,
  InscriptionLargeTestnet,
};
