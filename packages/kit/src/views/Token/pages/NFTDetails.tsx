import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import { ActionList, Button, Page, Spinner, Stack } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getNFTDetailsComponents } from '../../../utils/getNFTDetailsComponents';
import { ETokenPages } from '../router/type';

import type { ITokenParamList } from '../router/type';
import type { RouteProp } from '@react-navigation/core';

export function NFTDetails() {
  const navigation = useAppNavigation();
  const device = 'Touch';

  const route = useRoute<RouteProp<ITokenParamList, ETokenPages.NFTDetails>>();
  const { networkId, accountAddress, collectionAddress, itemId } = route.params;

  const { ImageContent, DetailContent } = getNFTDetailsComponents();

  const result = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceNFT.fetchNFTDetails({
        networkId,
        accountAddress,
        collectionAddress,
        itemId,
      });
      return r;
    },
    [accountAddress, collectionAddress, itemId, networkId],
    {
      watchLoading: true,
    },
  );

  const nft = result.result;

  const headerRight = useCallback(
    () => (
      <ActionList
        title="Actions"
        renderTrigger={
          <HeaderIconButton title="Actions" icon="DotHorOutline" />
        }
        items={[{ label: `Collect to ${device}`, icon: 'InboxOutline' }]}
      />
    ),
    [],
  );

  const handleSendPress = useCallback(() => {
    navigation.push(ETokenPages.Send, { isNFT: true });
  }, [navigation]);

  if (!nft)
    return (
      <Page>
        <Page.Body>
          {result.isLoading ? (
            <Stack justifyContent="center" alignItems="center">
              <Spinner />
            </Stack>
          ) : null}
        </Page.Body>
      </Page>
    );

  return (
    <Page scrollEnabled>
      <Page.Header title={nft.metadata.name} headerRight={headerRight} />
      <Page.Body>
        <Stack
          $gtMd={{
            flexDirection: 'row',
          }}
          pb="$5"
        >
          <Stack
            px="$5"
            pb="$5"
            $gtMd={{
              flexBasis: '33.3333%',
            }}
          >
            <Stack pb="100%">
              <Stack position="absolute" left={0} top={0} bottom={0} right={0}>
                <ImageContent nft={nft} />
              </Stack>
            </Stack>
            <Button icon="ArrowTopOutline" mt="$5" onPress={handleSendPress}>
              Send
            </Button>
          </Stack>
          <DetailContent networkId={networkId} nft={nft} />
        </Stack>
      </Page.Body>
    </Page>
  );
}
