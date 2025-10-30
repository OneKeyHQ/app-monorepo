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
}: {
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
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
              <AvailableAssetsTabViewListMobile assetType={item.type} />
            </Tabs.ScrollView>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </>
  );
}

export function ProtocolsTabContentDesktop() {
  return (
    <YStack pt="$6" gap="$8">
      <Recommended />
      <AvailableAssetsTabViewList />
    </YStack>
  );
}
