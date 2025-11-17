import { useCallback, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';

import { ETabName } from '../../../Perp/layouts/PerpMobileLayout';

const SwapProContainer = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ETabName | string>(
    ETabName.Positions,
  );
  const handleRefresh = useCallback(() => {
    console.log('handleRefresh');
  }, []);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '$bgApp' }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1, 3]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* <PerpTickerBar /> */}
      <XStack gap="$2.5" px="$4" pb="$4">
        <YStack flexBasis="35%" flexShrink={1}>
          {/* <PerpOrderBook /> */}
        </YStack>
        <YStack flexBasis="65%" flexShrink={1}>
          {/* <PerpTradingPanel isMobile /> */}
        </YStack>
      </XStack>
      <XStack
        bg="$bgApp"
        borderBottomWidth="$0.5"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
        pr="$4"
        pl="$4"
      >
        <XStack gap="$5">
          <TabBarItem
            name={ETabName.Positions}
            isFocused={activeTab === ETabName.Positions}
            onPress={setActiveTab}
          />
          <TabBarItem
            name={ETabName.OpenOrders}
            isFocused={activeTab === ETabName.OpenOrders}
            onPress={setActiveTab}
          />
        </XStack>
        <IconButton
          variant="tertiary"
          size="small"
          borderRadius="$full"
          icon="ClockTimeHistoryOutline"
          onPress={() => {}}
        />
      </XStack>
      <YStack flex={1}>
        <YStack
          display={activeTab === ETabName.Positions ? 'flex' : 'none'}
          flex={1}
        >
          {/* <PerpPositionsList
            handleViewTpslOrders={handleViewTpslOrders}
            isMobile
            useTabsList={false}
            disableListScroll
          /> */}
        </YStack>
        <YStack
          display={activeTab === ETabName.OpenOrders ? 'flex' : 'none'}
          flex={1}
        >
          {/* <PerpOpenOrdersList isMobile useTabsList={false} disableListScroll /> */}
        </YStack>
      </YStack>
    </ScrollView>
  );
};

export default SwapProContainer;
