import type { ComponentProps, FC } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  CustomSkeleton,
  FlatList,
  Modal,
  Pressable,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ArrivalTime } from '../components/ArrivalTime';
import { useSwapQuoteRequestParams } from '../hooks/useSwap';
import { stringifyTokens } from '../utils';

import { AmountLimit } from './AmountLimit';
import { LiquiditySources } from './LiquiditySources';
import { TokenInput } from './TokenInput';

import type { FetchQuoteResponse } from '../typings';
import type { ListRenderItem } from 'react-native';

type RoutesProps = {
  responses: FetchQuoteResponse[];
};

type RouteOptionProps = {
  response: FetchQuoteResponse;
  index: number;
};

const SelectRoutesContext = createContext({
  selectedIndex: 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelect: (index: number) => {},
});

const ItemSeparatorComponent = () => <Box h="3" />;

const ListEmptyComponent = () => (
  <Box>
    <Box w="full" h="20" borderRadius={12} overflow="hidden">
      <CustomSkeleton />
    </Box>
    <Box h="3" />
    <Box w="full" h="20" borderRadius={12} overflow="hidden">
      <CustomSkeleton />
    </Box>
  </Box>
);

type PlaceholderLineProps = ComponentProps<typeof Box>;
const PlaceholderLine: FC<PlaceholderLineProps> = ({ ...rest }) => (
  <Box flex="1" flexDirection="row" alignItems="center" {...rest}>
    <Box h="1px" w="full" bg="border-default" />
  </Box>
);

const RouteOption: FC<RouteOptionProps> = ({ response, index }) => {
  const { inputToken, outputToken } = useAppSelector((s) => s.swap);
  const { selectedIndex, onSelect } = useContext(SelectRoutesContext);
  const { data, limited } = response;

  return (
    <Pressable
      borderColor={selectedIndex !== index ? 'border-default' : 'text-success'}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      borderWidth="1"
      p="4"
      borderRadius={12}
      onPress={() => onSelect(index)}
    >
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flex="1" flexDirection="row">
          <TokenInput token={inputToken} amount={data?.sellAmount} />
          <PlaceholderLine ml={2} />
        </Box>
        <Box flex="1" justifyContent="center" flexDirection="row">
          <PlaceholderLine mr={2} />
          <LiquiditySources providers={data?.providers} />
          <PlaceholderLine ml={2} />
        </Box>
        <Box flex="1" flexDirection="row">
          <PlaceholderLine mr={2} />
          <TokenInput token={outputToken} amount={data?.buyAmount} rightAlign />
        </Box>
      </Box>
      <Box mt="3" flexDirection="row" justifyContent="space-between">
        <Box>
          <AmountLimit limited={limited} token={inputToken} />
        </Box>
        <ArrivalTime value={data?.arrivalTime} />
      </Box>
    </Pressable>
  );
};

const Routes: FC<RoutesProps> = ({ responses }) => {
  const renderItem: ListRenderItem<FetchQuoteResponse> = ({ item, index }) => (
    <RouteOption response={item} index={index} />
  );
  return (
    <FlatList
      data={responses}
      renderItem={renderItem}
      keyExtractor={(item, index) => item.data?.type ?? String(index)}
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const SelectRoutes = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [selectedIndex, onSelectIndex] = useState(-1);
  const params = useSwapQuoteRequestParams();
  const quote = useAppSelector((s) => s.swap.quote);
  const responses = useAppSelector((s) => s.swap.responses);
  const data = useMemo(() => responses ?? [], [responses]);

  useEffect(() => {
    async function main() {
      const index = data.findIndex((item) => item.data?.type === quote?.type);
      if (index !== -1) {
        onSelectIndex(index);
      }
    }
    main();
  }, [data, quote]);

  const onPrimaryActionPress = useCallback(() => {
    const response = data[selectedIndex];
    if (response) {
      if (response.data) {
        backgroundApiProxy.serviceSwap.setQuote(response.data);
        const hash = stringifyTokens(params?.tokenIn, params?.tokenOut);
        backgroundApiProxy.serviceSwap.setUserSelectedQuoter(
          hash,
          response.data.type,
        );
      }
      backgroundApiProxy.serviceSwap.setQuoteLimited(response.limited);
    }
    navigation.goBack();
  }, [selectedIndex, responses, navigation]);
  const contextValue = useMemo(
    () => ({ selectedIndex, onSelect: onSelectIndex }),
    [selectedIndex],
  );
  return (
    <SelectRoutesContext.Provider value={contextValue}>
      <Modal
        size="lg"
        header={intl.formatMessage({ id: 'title__select_route' })}
        hideSecondaryAction
        primaryActionTranslationId="action__confirm"
        onPrimaryActionPress={onPrimaryActionPress}
      >
        <Routes responses={data} />
      </Modal>
    </SelectRoutesContext.Provider>
  );
};

export default SelectRoutes;
