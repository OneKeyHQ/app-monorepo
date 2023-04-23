import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  Icon,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Searchbar,
  SectionList,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce, useSettings } from '../../../../hooks';

import { useCurrencyData, useCurrencyListData } from './hooks';
import { fuseSearch } from './utils';

import type { LayoutChangeEvent } from 'react-native';

type PopularCardProps = {
  currency: string;
  index: number;
  onPress: (currency: string) => void;
  boxWidth: number;
};

const PopularCard: FC<PopularCardProps> = ({
  currency,
  index,
  onPress,
  boxWidth,
}) => {
  const currencyData = useCurrencyData(currency);
  const { selectedFiatMoneySymbol } = useSettings();
  const isVerticalLayout = useIsVerticalLayout();
  const { width, ml } = useMemo(() => {
    const xSpace = isVerticalLayout ? 32 : 48;
    if (boxWidth >= 720) {
      return {
        width: Math.floor((boxWidth - xSpace - 12 * 2) / 3),
        ml: index % 3 === 0 ? 0 : 3,
      };
    }
    return {
      width: Math.floor((boxWidth - xSpace - 12) / 2),
      ml: index % 2 === 0 ? 0 : 3,
    };
  }, [boxWidth, index, isVerticalLayout]);

  return (
    <Pressable
      onPress={() => {
        onPress(currency);
      }}
    >
      {({ isPressed, isHovered }) => (
        <Box
          borderColor="border-default"
          borderWidth={1}
          borderRadius="12px"
          bgColor={
            // eslint-disable-next-line no-nested-ternary
            isPressed
              ? 'surface-pressed'
              : isHovered
              ? 'surface-hovered'
              : '"action-secondary-default"'
          }
          px={4}
          mb={3}
          py={2}
          h="68px"
          w={`${width}px`}
          ml={ml}
        >
          <Box flexDirection="column">
            <Typography.Body1Strong color="text-default">
              {`${currency.toLocaleUpperCase()} - ${currencyData.unit ?? '$'}`}
            </Typography.Body1Strong>
            <Typography.Button2
              lineHeight={14}
              numberOfLines={2}
              color="text-subdued"
            >
              {currencyData.name ?? ''}
            </Typography.Button2>
          </Box>
          {selectedFiatMoneySymbol === currency ? (
            <Box position="absolute" top="4" right="4" zIndex={9999}>
              <Icon size={20} name="CheckMini" color="icon-success" />
            </Box>
          ) : null}
        </Box>
      )}
    </Pressable>
  );
};

type PopularHeaderProps = {
  keys: string[];
  onPress: (currency: string) => void;
  title?: string;
  boxWidth: number;
};

const PopularHeader: FC<PopularHeaderProps> = ({
  title,
  keys,
  onPress,
  boxWidth,
}) => (
  <Box px={{ base: '16px', md: '24px' }}>
    <Typography.Subheading mb={3} color="text-subdued">
      {title ?? ''}
    </Typography.Subheading>
    <Box flexDirection="row" flexWrap="wrap" alignContent="flex-start">
      {keys.map((value, index) => (
        <PopularCard
          onPress={() => {
            onPress(value);
          }}
          key={index}
          currency={value}
          index={index}
          boxWidth={boxWidth}
        />
      ))}
    </Box>
  </Box>
);

type CurrencyCellProps = {
  item: string;
  onPress: (value: string) => void;
};

const CurrencyCell: FC<CurrencyCellProps> = ({ item, onPress }) => {
  const currencyData = useCurrencyData(item);
  const { selectedFiatMoneySymbol } = useSettings();
  return (
    <Pressable
      px={{ base: '16px', md: '24px' }}
      onPress={() => {
        onPress(item);
      }}
    >
      {({ isPressed, isHovered }) => (
        <Box
          p={2}
          mx={-2}
          rounded="sm"
          bgColor={
            // eslint-disable-next-line no-nested-ternary
            isPressed
              ? 'surface-pressed'
              : isHovered
              ? 'surface-hovered'
              : undefined
          }
        >
          <Typography.Body1Strong>{`${item.toLocaleUpperCase()} - ${
            currencyData.unit ?? '$'
          }`}</Typography.Body1Strong>
          <Typography.Body2 mt={1} color="text-subdued">
            {currencyData.name ?? ''}
          </Typography.Body2>
          {selectedFiatMoneySymbol === item ? (
            <Box position="absolute" top="4" right="4" zIndex={9999}>
              <Icon size={20} name="CheckMini" color="icon-success" />
            </Box>
          ) : null}
        </Box>
      )}
    </Pressable>
  );
};

type CurrencySectionLableProps = {
  title: string;
};

const CurrencySectionLable: FC<CurrencySectionLableProps> = ({ title }) => (
  <Box
    px={{ base: '16px', md: '24px' }}
    py={2}
    bgColor="background-default"
    borderBottomRadius="18px"
  >
    <Typography.Subheading color="text-subdued">{title}</Typography.Subheading>
  </Box>
);

const CurrencySelectModal: FC = () => {
  const [keyword, setKeyword] = useState('');
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { bottom } = useSafeAreaInsets();
  const terms = useDebounce(keyword, 500);
  const { popularList, ratesSectionList } = useCurrencyListData();
  const fiatMoneyMap = useAppSelector((s) => s.fiatMoney.map);
  const onClose = useModalClose();
  const { screenWidth } = useUserDevice();
  const defaultBoxWidth = screenWidth > SCREEN_SIZE.LARGE ? 720 : screenWidth;
  const [boxWidth, setBoxWidth] = useState(defaultBoxWidth);
  const searchList = useMemo(() => {
    if (terms.length > 0) {
      const originList = Object.keys(fiatMoneyMap).map((item) => ({
        ...fiatMoneyMap[item],
        key: item,
      }));
      return fuseSearch(originList, terms);
    }
    return [];
  }, [fiatMoneyMap, terms]);

  const onSelectedCurrency = useCallback(
    (value) => {
      backgroundApiProxy.servicePrice.currencyChanged(value);
      onClose();
    },
    [onClose],
  );

  const modalOnLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width) {
      setBoxWidth(width);
    }
  }, []);

  const headerComponent = useMemo(
    () => (
      <PopularHeader
        title={intl.formatMessage({ id: 'form__popular' })}
        onPress={(currency) => {
          onSelectedCurrency(currency);
        }}
        keys={popularList}
        boxWidth={boxWidth}
      />
    ),
    [boxWidth, intl, onSelectedCurrency, popularList],
  );

  const emptyComponent = useMemo(
    () => (
      <Empty
        title={intl.formatMessage(
          { id: 'title__no_result_for_str' },
          { keyword },
        )}
        emoji="👀"
        handleAction={() => {
          setKeyword('');
        }}
        actionTitle={intl.formatMessage({ id: 'action__start_a_new_search' })}
        actionProps={{ type: 'basic' }}
      />
    ),
    [intl, keyword],
  );

  const renderItem = ({ item }: { item: string }) => (
    <CurrencyCell
      onPress={(value) => {
        onSelectedCurrency(value);
      }}
      item={item}
    />
  );

  return (
    <Modal
      onLayout={modalOnLayout}
      height="640px"
      footer={null}
      size="xl"
      header={intl.formatMessage({ id: 'form__default_currency' })}
      staticChildrenProps={{
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        h="58px"
        justifyContent="center"
        py={2}
        px={isVerticalLayout ? 4 : 6}
      >
        <Searchbar
          flex={1}
          w="auto"
          bgColor="action-secondary-default"
          borderWidth={1}
          borderColor="border-default"
          placeholder={intl.formatMessage({
            id: 'form__search_currency_unit_or_name',
          })}
          value={keyword}
          onClear={() => setKeyword('')}
          onChangeText={(text) => {
            setKeyword(text);
          }}
        />
      </Box>
      <KeyboardAvoidingView flex={1}>
        <SectionList
          flex={1}
          mt={1}
          contentContainerStyle={{ paddingBottom: bottom }}
          sections={terms.length > 0 ? searchList : ratesSectionList}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={terms.length > 0 ? null : headerComponent}
          renderSectionHeader={({ section: { title } }) => (
            <CurrencySectionLable
              title={
                title === 'crypto'
                  ? intl.formatMessage({ id: 'form__crypto' })
                  : intl.formatMessage({ id: 'form__fiat' })
              }
            />
          )}
          ListEmptyComponent={emptyComponent}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CurrencySelectModal;
