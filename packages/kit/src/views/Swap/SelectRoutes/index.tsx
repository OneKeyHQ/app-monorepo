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
  Modal,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ArrivalTime } from '../components/ArrivalTime';
import { useSwapQuoteRequestParams } from '../hooks/useSwap';
import { multiply, stringifyTokens } from '../utils';

import { AmountLimit } from './AmountLimit';
import { LiquiditySources } from './LiquiditySources';
import { TokenInput } from './TokenInput';
import { useTokenOutput } from './utils';

import type { FetchQuoteResponse } from '../typings';

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
  const intl = useIntl();
  const { inputToken, outputToken } = useAppSelector((s) => s.swap);
  const { selectedIndex, onSelect } = useContext(SelectRoutesContext);
  const { data, limited } = response;
  const buyAmount = data?.buyAmount ?? '0';
  const isDisabled = !!limited;
  let percentageFee = data?.percentageFee ? Number(data?.percentageFee) : 0;
  if (data?.type === 'swftc') {
    percentageFee += 0.002;
  }
  const noFeeAmount = multiply(buyAmount, 1 - percentageFee);
  const nofeePrice = useTokenOutput({
    token: outputToken,
    amount: noFeeAmount,
  });

  return (
    <Pressable
      borderColor={selectedIndex !== index ? 'border-default' : 'text-success'}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      borderWidth="1"
      p="4"
      borderRadius={12}
      onPress={() => onSelect(index)}
      isDisabled={isDisabled}
      mb="3"
    >
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        w="full"
      >
        <Box flex="1" flexDirection="row">
          <TokenInput
            token={inputToken}
            amount={data?.sellAmount}
            isDisabled={isDisabled}
          />
          <PlaceholderLine ml={2} />
        </Box>
        <Box flex="1" justifyContent="center" flexDirection="row">
          <PlaceholderLine mr={2} />
          <LiquiditySources
            providers={data?.providers}
            isDisabled={isDisabled}
          />
          <PlaceholderLine ml={2} />
        </Box>
        <Box flex="1" flexDirection="row">
          <PlaceholderLine mr={2} />
          <TokenInput
            token={outputToken}
            amount={buyAmount}
            rightAlign
            isDisabled={isDisabled}
          />
        </Box>
      </Box>
      <Box mt="3" flexDirection="row" justifyContent="space-between">
        <Box>
          <ArrivalTime value={data?.arrivalTime} />
        </Box>
        <Box>
          <Typography.Caption color="text-subdued">
            {intl.formatMessage({ id: 'form__no_fee_price' })}
            {nofeePrice}
          </Typography.Caption>
        </Box>
      </Box>
      <AmountLimit response={response} token={inputToken} />
    </Pressable>
  );
};

const Routes: FC<RoutesProps> = ({ responses }) => {
  const intl = useIntl();
  const data = responses.map((res, index) => ({ ...res, index }));
  const limited = data.filter((item) => item.limited);
  const notLimited = data.filter((item) => !item.limited);

  return (
    <ScrollView>
      <Box>
        <Box>
          {notLimited.map((item) => (
            <RouteOption
              key={item.data?.type ?? ''}
              response={item}
              index={item.index}
            />
          ))}
        </Box>
        {limited.length ? (
          <Box>
            <Typography.Subheading mb="3" color="text-subdued">
              {intl.formatMessage({ id: 'form__unavailable_uppercase' })}
            </Typography.Subheading>
            <Box>
              {limited.map((item) => (
                <RouteOption
                  key={item.data?.type ?? ''}
                  response={item}
                  index={item.index}
                />
              ))}
            </Box>
          </Box>
        ) : null}
      </Box>
    </ScrollView>
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
    function main() {
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
  }, [selectedIndex, data, navigation, params]);

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
        {data.length === 0 ? (
          <ListEmptyComponent />
        ) : (
          <Routes responses={data} />
        )}
      </Modal>
    </SelectRoutesContext.Provider>
  );
};

export default SelectRoutes;
