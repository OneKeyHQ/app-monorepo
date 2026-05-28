import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Empty,
  Page,
  ScrollView,
  SectionList,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IKytSupportedAsset } from '@onekeyhq/shared/types/kyt';

type ISupportedToken = {
  symbol: string;
  name: string;
  tokenImageUri: string;
};

type ISupportedNetworkSection = {
  networkName: string;
  networkId: string;
  tokens: ISupportedToken[];
};

// The API returns a flat list (one entry per network+token). Group it by
// networkId, preserving the server-provided order of first appearance.
function groupByNetwork(
  list: IKytSupportedAsset[],
): ISupportedNetworkSection[] {
  const sections: ISupportedNetworkSection[] = [];
  const indexByNetworkId = new Map<string, number>();
  for (const item of list) {
    let idx = indexByNetworkId.get(item.networkId);
    if (idx === undefined) {
      idx = sections.length;
      indexByNetworkId.set(item.networkId, idx);
      sections.push({
        networkId: item.networkId,
        networkName: item.networkName,
        tokens: [],
      });
    }
    sections[idx].tokens.push({
      symbol: item.tokenSymbol,
      name: item.tokenName,
      tokenImageUri: item.tokenLogoURI,
    });
  }
  return sections;
}

const ReceiveRiskSupportedAssetsPage = () => {
  const [sections, setSections] = useState<ISupportedNetworkSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchSupportedAssets = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const list =
        await backgroundApiProxy.serviceSetting.getKytSupportedAssets();
      setSections(groupByNetwork(list));
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSupportedAssets();
  }, [fetchSupportedAssets]);

  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="QuestionmarkOutline"
        onPress={() => {
          // TODO: open help / docs once content is ready.
        }}
      />
    ),
    [],
  );

  const renderBody = useCallback(() => {
    if (isLoading) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }
    if (isError) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Empty
            icon="BrokenLinkOutline"
            title="Network error"
            description="Failed to load supported assets. Please check your connection and try again."
            button={
              <Button
                testID="receive-risk-supported-assets-retry"
                variant="primary"
                onPress={() => {
                  void fetchSupportedAssets();
                }}
              >
                Retry
              </Button>
            }
          />
        </Stack>
      );
    }
    return (
      <ScrollView>
        <YStack pb="$10">
          {sections.map((section) => (
            <YStack key={section.networkId}>
              <SectionList.SectionHeader title={section.networkName} />
              {section.tokens.map((token) => (
                <ListItem
                  key={`${section.networkId}-${token.symbol}`}
                  title={token.symbol}
                  subtitle={token.name}
                  renderAvatar={
                    <Token size="md" tokenImageUri={token.tokenImageUri} />
                  }
                />
              ))}
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    );
  }, [fetchSupportedAssets, isError, isLoading, sections]);

  return (
    <Page>
      <Page.Header title="Supported assets" headerRight={headerRight} />
      <Page.Body>{renderBody()}</Page.Body>
    </Page>
  );
};

export default ReceiveRiskSupportedAssetsPage;
