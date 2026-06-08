import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  Empty,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { RECEIVE_RISK_MONITORING_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IKytSupportedAsset } from '@onekeyhq/shared/types/kyt';

type ISupportedToken = {
  symbol: string;
  name: string;
  tokenAddress: string;
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
      tokenAddress: item.tokenAddress,
      tokenImageUri: item.tokenLogoURI,
    });
  }
  return sections;
}

function NetworkAssetSection({
  section,
}: {
  section: ISupportedNetworkSection;
}) {
  const intl = useIntl();

  return (
    <YStack
      mx="$5"
      bg="$bgSubdued"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      overflow="hidden"
    >
      <XStack px="$4" py="$2.5" alignItems="center" gap="$3">
        <Stack w="$6" h="$6" alignItems="center" justifyContent="center">
          <NetworkAvatar networkId={section.networkId} size="$6" />
        </Stack>
        <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
          {section.networkName}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
          {intl.formatMessage(
            { id: ETranslations.count_assets },
            { count: section.tokens.length },
          )}
        </SizableText>
      </XStack>
      <YStack bg="$bgApp">
        {section.tokens.map((token, index) => (
          <YStack
            key={`${section.networkId}-${token.tokenAddress || token.symbol}`}
          >
            <ListItem
              mx="$0"
              px="$4"
              py="$1.5"
              borderRadius={0}
              title={token.symbol}
              subtitle={token.name}
              renderAvatar={
                <Token
                  size="md"
                  tokenImageUri={token.tokenImageUri}
                  bg="$transparent"
                />
              }
            />
            {index < section.tokens.length - 1 ? (
              <Divider ml="$16" borderColor="$neutral3" />
            ) : null}
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

const ReceiveRiskSupportedAssetsPage = () => {
  const intl = useIntl();
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
          openUrlInApp(
            RECEIVE_RISK_MONITORING_HELP_LINK,
            intl.formatMessage({
              id: ETranslations.prime_feature_receive_risk_monitoring__title,
            }),
          );
        }}
      />
    ),
    [intl],
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
            title={intl.formatMessage({
              id: ETranslations.global_network_error,
            })}
            description={intl.formatMessage({
              id: ETranslations.kyt_supported_assets_load_error__desc,
            })}
            button={
              <Button
                testID="receive-risk-supported-assets-retry"
                variant="primary"
                onPress={() => {
                  void fetchSupportedAssets();
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
            }
          />
        </Stack>
      );
    }
    return (
      <ScrollView>
        <YStack py="$4" pb="$10" gap="$3">
          {sections.map((section) => (
            <NetworkAssetSection key={section.networkId} section={section} />
          ))}
        </YStack>
      </ScrollView>
    );
  }, [fetchSupportedAssets, intl, isError, isLoading, sections]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.kyt_supported_assets__title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>{renderBody()}</Page.Body>
    </Page>
  );
};

export default ReceiveRiskSupportedAssetsPage;
