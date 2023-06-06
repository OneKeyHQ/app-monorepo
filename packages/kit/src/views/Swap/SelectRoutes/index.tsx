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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ArrivalTime } from '../components/ArrivalTime';
import { stringifyTokens } from '../utils';

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
    <Box
      borderTopColor="border-default"
      w="full"
      h="1"
      borderStyle={platformEnv.isNative ? 'solid' : 'dashed'}
      borderTopWidth={platformEnv.isNative ? 0.5 : 1}
    />
  </Box>
);

const RouteOption: FC<RouteOptionProps> = ({ response, index }) => {
  const intl = useIntl();
  const { inputToken, outputToken } = useAppSelector((s) => s.swap);
  const { selectedIndex, onSelect } = useContext(SelectRoutesContext);
  const { data, limited } = response;
  const buyAmount = data?.estimatedBuyAmount ?? data?.buyAmount;
  const isDisabled = !!limited;

  const nofeePrice = useTokenOutput({
    token: outputToken,
    amount: data?.buyAmount,
  });

  return (
    <Pressable
      borderColor={selectedIndex !== index ? 'border-default' : 'text-success'}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      borderWidth={1.5}
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
          <Box flex="1">
            <PlaceholderLine minW={1} ml={2} />
          </Box>
        </Box>
        <Box justifyContent="center" flexDirection="row" px="1">
          <LiquiditySources
            providers={data?.providers}
            isDisabled={isDisabled}
          />
        </Box>
        <Box flex="1" flexDirection="row">
          <PlaceholderLine minW={1} mr={2} />
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
  const tokenIn = useAppSelector((s) => s.swap.inputToken);
  const tokenOut = useAppSelector((s) => s.swap.outputToken);
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
        const hash = stringifyTokens(tokenIn, tokenOut);
        backgroundApiProxy.serviceSwap.setUserSelectedQuoter(
          hash,
          response.data.type,
        );
      }
      backgroundApiProxy.serviceSwap.setQuoteLimited(response.limited);
    }
    navigation.goBack();
  }, [selectedIndex, data, navigation, tokenIn, tokenOut]);

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
