import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';

import { Box, Modal, Text, useIsVerticalLayout } from '@onekeyhq/components';

import {
  OverviewNFTDetailRoutes,
  OverviewNFTDetailRoutesParams,
} from '../../../routes/Modal/OverviewNFTDetail';
import { NFTItem } from '../Components/NFTItem';
import { GridList } from '../Home/NFTSection/NFTList';

type RouteProps = RouteProp<
  OverviewNFTDetailRoutesParams,
  OverviewNFTDetailRoutes.OverviewNFTDetailScreen
>;

const Header = () => {
  const isSmallScreen = useIsVerticalLayout();

  if (isSmallScreen) {
    <Box flexDirection="column" alignItems="center">
      <Box borderRadius="full" size="56px" bgColor="blue.200" />
      <Text mt="8px" typography="Heading">
        Zapper NFTs
      </Text>
    </Box>;
  }
  return (
    <Box flexDirection="row" alignItems="center">
      <Box borderRadius="full" size="40px" bgColor="blue.200" />
      <Text ml="8px" typography="DisplayLarge">
        Zapper NFTs
      </Text>
    </Box>
  );
};

const TagsView = () => <Box />;

export const NFTsDetail: FC = () => {
  const isSmallScreen = useIsVerticalLayout();
  const space = isSmallScreen ? 12 : 20;
  const route = useRoute<RouteProps>();
  const { group } = route.params;
  const { width } = useWindowDimensions();

  const itemWidth = isSmallScreen ? (width - 44) / 2 : 173;
  const itemHeight = isSmallScreen ? itemWidth + 44 : 210;
  const numColumns = isSmallScreen ? 2 : 4;

  return (
    <Modal
      height="560px"
      size="2xl"
      header="Zapper NFTs"
      hideSecondaryAction
      footer={null}
      scrollViewProps={{
        children: (
          <Box>
            <Header />
            <Text my="24px" typography="Body2" color="text-subdued">
              ⚡️ Zapper is Leveling Up ⚡️ We're happy to introduce quests,
              levels and XP to the dashboard. Are you ready to get Zapper
              pill'd? 🏆 Rewards Once you reach certain levels, you will be able
              to mint reward NFTs. ⚔️ Quests Initially, there will be two types
              of quests. • Daily Quests: Every day
            </Text>

            <TagsView />
            <GridList
              datas={group.items}
              space={space}
              numColumns={numColumns}
              renderItem={(item, index) => (
                <NFTItem
                  key={`rowIndex${index}`}
                  item={item}
                  width={itemWidth}
                  height={itemHeight}
                />
              )}
            />
          </Box>
        ),
      }}
    />
  );
};

export default NFTsDetail;
