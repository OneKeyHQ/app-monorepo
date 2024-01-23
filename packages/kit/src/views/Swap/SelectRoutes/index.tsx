import type { FC } from 'react';
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
  Image,
  Modal,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ArrivalTime } from '../components/ArrivalTime';
import { stringifyTokens } from '../utils';

import { AmountLimit } from './AmountLimit';
import { useTokenOutput } from './utils';

import type { FetchQuoteResponse, Provider } from '../typings';

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

const RouteLogo = ({ imageSrc }: { imageSrc?: string }) =>
  imageSrc ? (
    <Box
      w="full"
      h="full"
      bgColor="surface-default"
      borderRadius="full"
      overflow="hidden"
    >
      <Image
        w="full"
        h="full"
        borderRadius="full"
        overflow="hidden"
        src={imageSrc}
      />
    </Box>
  ) : (
    <Image
      w="full"
      h="full"
      borderRadius="full"
      overflow="hidden"
      source={require('@onekeyhq/kit/assets/logo.png')}
    />
  );

const ProviderNames = ({ providers }: { providers?: Provider[] }) => {
  const intl = useIntl();
  if (!providers || providers.length === 1) {
    return null;
  }
  return (
    <Box mt="3">
      <Typography.Caption color="text-subdued">
        {intl.formatMessage(
          { id: 'form__via_str' },
          { '0': providers.map((o) => o.name).join(', ') },
        )}
      </Typography.Caption>
    </Box>
  );
};

const RouteOption: FC<RouteOptionProps> = ({ response, index }) => {
  const intl = useIntl();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const { selectedIndex, onSelect } = useContext(SelectRoutesContext);
  const { data, limited } = response;
  const isDisabled = !!limited;

  const feePrice = useTokenOutput({
    token: outputToken,
    amount: data?.estimatedBuyAmount ?? data?.buyAmount,
  });

  const nofeePrice = useTokenOutput({
    token: outputToken,
    amount: data?.buyAmount,
  });
  const providers = response.data?.providers;
  const imageSrc = providers?.[0]?.logoUrl;
  let name = providers?.[0]?.name;
  if (providers && providers.length > 2) {
    name = intl.formatMessage({ id: 'form__multiple_routes' });
  }

  return (
    <Pressable
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      bgColor={selectedIndex === index ? 'surface-selected' : undefined}
      p="2"
      borderRadius={12}
      onPress={() => onSelect(index)}
      isDisabled={isDisabled}
      mb="3"
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row">
          <Box position="relative" w="10" h="10" mr="3">
            <Box w="10" h="10">
              <RouteLogo imageSrc={imageSrc} />
            </Box>
            <Box
              position="absolute"
              backgroundColor="surface-default"
              w="5"
              h="5"
              right="0"
              top="-1"
              borderRadius="full"
              borderWidth={1}
              borderColor="border-default"
              overflow="hidden"
            >
              <RouteLogo imageSrc={data?.quoterlogo} />
            </Box>
          </Box>
          <Box>
            <Typography.Body1Strong maxW="32" numberOfLines={1}>
              {name || 'OneKey Swap'}
            </Typography.Body1Strong>
            <ArrivalTime typography="Body2" value={data?.arrivalTime} />
          </Box>
        </Box>
        <Box alignItems="flex-end">
          <Typography.Body1Strong>{feePrice}</Typography.Body1Strong>
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'form__no_fee_price' })}
            {nofeePrice}
          </Typography.Body2>
        </Box>
      </Box>
      <ProviderNames providers={response.data?.providers} />
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
