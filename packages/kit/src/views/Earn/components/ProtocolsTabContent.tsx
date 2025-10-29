import { Tabs, YStack } from '@onekeyhq/components';
import type {
  EAvailableAssetsTypeEnum,
  IEarnAvailableAssetProtocol,
} from '@onekeyhq/shared/types/earn';

import {
  AvailableAssetsTabViewList,
  AvailableAssetsTabViewListMobile,
} from './AvailableAssetsTabViewList';
import { Recommended } from './Recommended';

const renderEarnTabBar = (props: any, containerStyle?: any) => (
  <Tabs.TabBar {...props} containerStyle={containerStyle} />
);

export function ProtocolsTabContentMobile({
  assetTabData,
  handleTokenPress,
}: {
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  handleTokenPress: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
}) {
  return (
    <>
      <YStack px="$5" pt="$6" gap="$8">
        <Recommended />
      </YStack>
      <Tabs.Container
        renderTabBar={(subProps) =>
          renderEarnTabBar(subProps, { px: '$5', pt: '$4' })
        }
      >
        {assetTabData.map((item) => (
          <Tabs.Tab name={item.title} key={item.type}>
            <Tabs.ScrollView>
              <AvailableAssetsTabViewListMobile
                onTokenPress={handleTokenPress}
                assetType={item.type}
              />
            </Tabs.ScrollView>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </>
  );
}

export function ProtocolsTabContentDesktop({
  handleTokenPress,
}: {
  handleTokenPress: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
}) {
  return (
    <YStack pt="$6" gap="$8">
      <Recommended />
      <AvailableAssetsTabViewList onTokenPress={handleTokenPress} />
    </YStack>
  );
}
