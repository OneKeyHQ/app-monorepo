import {
  ComponentProps,
  FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

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
import { useSwapQuoteRequestParams, useSwapRecipient } from '../hooks/useSwap';
import { SwapQuoter } from '../quoter';
import { FetchQuoteResponse } from '../typings';

import { AmountLimit } from './AmountLimit';
import { LiquiditySources } from './LiquiditySources';
import { TokenInput } from './TokenInput';

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
  const [selectedIndex, onSelect] = useState(0);
  const params = useSwapQuoteRequestParams();
  const recipient = useSwapRecipient();
  const [responses, setResponses] = useState<FetchQuoteResponse[]>([]);

  useEffect(() => {
    async function main() {
      if (params) {
        const data = await SwapQuoter.client.fetchQuotes({
          ...params,
          receivingAddress: recipient?.address,
        });
        if (data) {
          setResponses(data);
        }
      }
    }
    main();
  }, [params, recipient?.address]);

  const onPrimaryActionPress = useCallback(() => {
    const response = responses[selectedIndex];
    if (response) {
      if (response.data) {
        backgroundApiProxy.serviceSwap.setQuote(response.data);
      }
      backgroundApiProxy.serviceSwap.setQuoteLimited(response.limited);
    }
    navigation.goBack();
  }, [selectedIndex, responses, navigation]);

  return (
    <SelectRoutesContext.Provider value={{ selectedIndex, onSelect }}>
      <Modal
        size="lg"
        header={intl.formatMessage({ id: 'title__select_route' })}
        hideSecondaryAction
        primaryActionTranslationId="action__confirm"
        onPrimaryActionPress={onPrimaryActionPress}
      >
        <Routes responses={responses} />
      </Modal>
    </SelectRoutesContext.Provider>
  );
};

export default SelectRoutes;
