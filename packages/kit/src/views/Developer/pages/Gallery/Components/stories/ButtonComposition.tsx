import { useState } from 'react';

import {
  Button,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

const TOKEN_ICON =
  'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png';
const NETWORK_ICON = 'https://uni.onekey-asset.com/static/chain/eth.png';

function LeadingVisualExample() {
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const media = useMedia();
  const height = media.gtMd ? 36 : 32;
  return (
    <YStack gap="$3" alignItems="flex-start">
      <XStack gap="$2" flexWrap="wrap">
        <Button
          testID="button-composition-leading"
          size="small"
          variant="secondary"
          childrenAsText={false}
          height={height}
          py="$0"
          pl={6}
          pr={14}
          borderRadius="$full"
          disabled={loading}
          opacity={1}
          aria-busy={loading}
          accessibilityLabel="Preview an action with a leading visual"
          onPress={() => setLoading(true)}
        >
          <XStack alignItems="center" gap="$2">
            <XStack
              width={24}
              height={24}
              alignItems="center"
              justifyContent="center"
            >
              {loading ? (
                <Spinner size="small" />
              ) : (
                <Token
                  size="sm"
                  tokenImageUri={TOKEN_ICON}
                  networkImageUri={NETWORK_ICON}
                />
              )}
            </XStack>
            <SizableText size="$bodyMdMedium">Claim 0.000029 USDT</SizableText>
          </XStack>
        </Button>
        <Button
          testID="button-composition-more"
          size="small"
          variant="secondary"
          height={height}
          borderRadius="$full"
          onPress={() => setMore(true)}
        >
          +1
        </Button>
      </XStack>
      {more ? (
        <SizableText size="$bodySm">More items preview</SizableText>
      ) : null}
      <Button
        testID="button-composition-reset"
        size="small"
        onPress={() => {
          setLoading(false);
          setMore(false);
        }}
      >
        Reset preview
      </Button>
    </YStack>
  );
}

export default function ButtonCompositionGallery() {
  return (
    <Layout
      componentName="Button composition"
      elements={[
        {
          title: 'Leading visual and loading state',
          element: <LeadingVisualExample />,
        },
      ]}
    />
  );
}
