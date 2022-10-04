import React, { useCallback, useEffect, useMemo } from 'react';

import { Image } from 'native-base';
import { ListRenderItem } from 'react-native';

import { Box, Empty, FlatList, ScrollView } from '@onekeyhq/components/src';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { MarketCategory, MarketTokenItem } from '../../store/reducers/market';

import ListHeaderComponent from './Components/MarketListHeader';
import MarketTokenCell from './Components/MarketTokenCell';
import { MarketHeader, MarketHeaderNative } from './Components/MarketTopHeader';
import RecommendedTokenBox from './Components/RecommendedToken';

// 判断大小屏  小屏幕
const mokeData = [
  { symbol: 'eth', name: 'Ethereum', price: 88888 },
  { symbol: 'eth', name: 'Ethereum', price: 88888.12 },
  { symbol: 'eth', name: 'Ethereum', price: 88888.54 },
];

const hotTokenData = [
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
  { symbol: 'eth', name: 'Ethereum', icon: '' },
];

const sparkMokeData = [
  19929.694935236184, 20009.966350515646, 19975.540601917564,
  19798.739202065623, 19838.681855106406, 19797.43679527315, 19693.041455432674,
  19674.818580605563, 19738.324136879353, 19734.715040825704,
  19528.583240156255, 19422.59394859203, 19440.93216955394, 19459.41623477264,
  19458.652556832738, 18746.92089683798, 18776.330377164395, 18813.965253933402,
  18755.931673391373, 18492.623682283283, 18474.1066619127, 18471.224601532595,
  18479.50337751628, 18704.88170580541, 18721.995366741372, 18828.439331054396,
  19165.81135271528, 19344.40433592218, 19045.042462354908, 19218.495786143714,
  18980.91406443351, 19101.611719444067, 19496.140995678343, 19549.679390282075,
  19549.62267526214, 19610.73981971188, 19546.409143501933, 19527.745083650978,
  19451.87426431885, 19472.851759774338, 19374.16297737101, 19318.559073725566,
  19388.28798397148, 19377.458562024956, 19318.842407507334, 19352.439064548715,
  19225.358546500232, 19289.143996819017, 19243.12042080249, 19136.776520500032,
  18929.983249274883, 19061.266616648823, 19112.224526258957,
  19133.096285980726, 18830.917030469813, 18900.724863760188,
  19051.021660257473, 18987.000710466196, 18936.29784696831, 18952.908563798796,
  18874.85455696598, 18926.675241757286, 18879.008918501793, 19039.644655758144,
  19020.63875334828, 18992.143011684653, 18988.272713812923, 18877.624064665142,
  18931.200220930998, 18882.495753854502, 19011.034496350338, 19056.59249878222,
  19172.755683088002, 19235.566308587782, 19287.065702169362,
  19311.025221809035, 19245.03221136517, 19246.993076140407, 19525.830420911836,
  19721.930672889866, 19009.395338106424, 18924.909554764974, 18469.79380196139,
  18424.697746688696, 18527.801868254202, 18424.79471209442, 18491.178551216493,
  18734.239323018155, 18711.610899114334, 18730.545569908827, 18678.85407460887,
  18766.092389426518, 18908.68709354807, 19255.560738985212, 19187.167284247676,
  19135.07353524722, 19247.370930919522, 19230.47256046814, 18933.988677608857,
  18950.28993893529, 19011.967671170914, 19070.840195401684, 19077.055847984844,
  19174.741377433762, 19362.265050656337, 19258.939685615693,
  19177.604483873263, 19376.75478977833, 19447.840839850032, 19332.218734870003,
  19326.272543671686, 19314.240320510795, 19401.938521992517, 19475.02644198708,
  19384.513560212967, 19347.187044172817, 19231.834838756615,
  19064.382030131037, 19051.92792565541, 19053.030561231113, 18913.982365833832,
  18885.34166619524, 18912.723290964983, 18663.933121230413, 18783.829395013956,
  18799.488933336543, 18751.214368114255, 18696.267806813692, 18815.96096824149,
  18901.874233727016, 18940.345340343898, 19279.774244453452,
  19309.223005327487, 19150.943850263175, 19141.902616020478,
  19124.784836215444, 19068.742869048667, 19143.382544912067,
  19127.294843115305, 19094.034603343818, 19005.077529786216, 19027.43987950111,
  19022.445466400695, 19004.654623015434, 19059.290794125267,
  19171.015527257692, 19127.151148138346, 19074.168081453667,
  19071.189804346395, 19107.72466904934, 19079.80619331561, 19145.34597657218,
  19113.608040102754, 19144.37040543614, 18945.92895807797, 18924.70305106518,
  18936.69527506283, 18967.963555127793, 18991.822746421247, 18954.731663895203,
  19046.06437451914, 19015.09289158551, 19002.235634430614, 19064.176212932678,
  19104.779994007527, 19084.73276515793, 19039.226583640142, 19086.468179901083,
];

// const categoryData: MarketCategory[] = [
//   {
//     categoryId: 'bitcoin',
//     name: 'favorite',
//     type: 'tab',
//   },
//   {
//     categoryId: 'bitcoin',
//     name: 'bitcoin',
//     type: 'tab',
//   },
//   {
//     categoryId: 'bitcoin',
//     name: 'bitcoin',
//     type: 'tab',
//   },
//   {
//     categoryId: 'bitcoin',
//     name: 'bitcoin',
//     type: 'tab',
//   },
//   {
//     categoryId: 'bitcoin',
//     name: 'bitcoin',
//     type: 'tab',
//   },
//   {
//     categoryId: 'bitcoin',
//     name: 'bitcoin',
//     type: 'tab',
//   },
// ];

const Market = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const categorys: MarketCategory[] = useAppSelector((s) => s.market.categorys);

  const cacheTokenMap: Record<string, MarketTokenItem[]> = useAppSelector(
    (s) => s.market.categoryTokenMap,
  );

  const currentCategory: MarketCategory | undefined = useAppSelector(
    (s) => s.market.currentCategory,
  );

  const currentMarkeList = useMemo(() => {
    console.log('currentMarkeList-change', currentCategory);
    if (currentCategory) {
      return cacheTokenMap[currentCategory.categoryId];
    }
    return [];
  }, [currentCategory, cacheTokenMap]);

  useEffect(() => {
    console.log('market---useEffect');
    backgroundApiProxy.serviceMarket.fetchMarketCategorys();
  }, []);

  const renderItem: ListRenderItem<MarketTokenItem> = useCallback(
    ({ item }) => (
      <MarketTokenCell
        marketItem={item}
        onPress={() => {
          // goto detail
        }}
      />
    ),
    [],
  );
  return (
    <Box flex="1">
      {isVerticalLayout ? (
        <MarketHeaderNative />
      ) : (
        <MarketHeader
          onChange={(keyword) => {
            console.log('keyword--', keyword);
          }}
          keyword=""
        />
      )}

      <ScrollView p={4} bg="background-default">
        <ListHeaderComponent categorys={categorys} />
        <FlatList
          w="full"
          renderItem={renderItem}
          data={currentMarkeList}
          ListEmptyComponent={
            <Empty
              emoji="⭐️"
              title="No Favorite Token"
              subTitle="Your Favorite tokens will show here."
            />
          }
        />
        {/* <Box p="3" width="full" maxWidth="640px">
          <Typography.Heading mb="3">Hot Tokens</Typography.Heading>
          <Box
            flexDirection="row"
            alignContent="flex-start"
            flexWrap="wrap"
            width="full"
          >
            {hotTokenData.map((t) => (
              <Box m="4">
                <RecommendedTokenBox
                  name={t.name}
                  icon={t.icon}
                  symbol={t.symbol}
                />
              </Box>
            ))}
          </Box>
          <Button size="xl" type="primary">
            Add
          </Button>
        </Box> */}
      </ScrollView>
    </Box>
  );
};

export default Market;
