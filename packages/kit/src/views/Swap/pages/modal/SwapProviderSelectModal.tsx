import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type {
  IImageSourceProps,
  IKeyOfIcons,
  IPageNavigationProp,
} from '@onekeyhq/components';
import {
  Button,
  Icon,
  IconButton,
  Image,
  Page,
  Popover,
  SectionList,
  Select,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapProviderSortAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSortedQuoteListAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import SwapProviderListItem from '../../components/SwapProviderListItem';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

enum ESwapProviderStatus {
  AVAILABLE = 'Available',
  UNAVAILABLE = 'Unavailable',
}

const InformationItem = ({
  icon,
  content,
}: {
  icon: IKeyOfIcons;
  content: string;
}) => (
  <XStack alignItems="flex-start" gap="$2">
    <Icon flexShrink={0} color="$iconSubdued" size="$5" name={icon} />
    <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
      {content}
    </SizableText>
  </XStack>
);

const SwapProviderSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const intl = useIntl();
  const [swapSortedList] = useSwapSortedQuoteListAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapManualSelect] = useSwapManualSelectQuoteProvidersAtom();
  const [providerSort, setProviderSort] = useSwapProviderSortAtom();
  const [settingsPersist] = useSettingsPersistAtom();
  const [currentSelectQuote] = useSwapQuoteCurrentSelectAtom();

  const onSelectSortChange = useCallback(
    (value: ESwapProviderSort) => {
      setProviderSort(value);
    },
    [setProviderSort],
  );

  const swapProviderSortSelectItems = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.provider_recommend }),
        value: ESwapProviderSort.RECOMMENDED,
      },
      {
        label: intl.formatMessage({ id: ETranslations.provider_sort_item_gas }),
        value: ESwapProviderSort.GAS_FEE,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.provider_sort_item_swap_duration,
        }),
        value: ESwapProviderSort.SWAP_DURATION,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.provider_sort_item_received,
        }),
        value: ESwapProviderSort.RECEIVED,
      },
    ],
    [intl],
  );
  const sectionData = useMemo(() => {
    const availableList = swapSortedList.filter(
      (item) => item.toAmount && !item.limit?.min && !item.limit?.max,
    );
    const unavailableList = swapSortedList.filter(
      (item) => !item.toAmount || item.limit?.min || item.limit?.max,
    );
    return [
      ...(availableList?.length > 0
        ? [
            {
              title: 'Available',
              type: ESwapProviderStatus.AVAILABLE,
              data: availableList,
            },
          ]
        : []),
      ...(unavailableList?.length > 0
        ? [
            {
              title: intl.formatMessage({
                id: ETranslations.provider_unavailable,
              }),
              type: ESwapProviderStatus.UNAVAILABLE,
              data: unavailableList,
            },
          ]
        : []),
    ];
  }, [intl, swapSortedList]);
  const onSelectQuote = useCallback(
    (item: IFetchQuoteResult) => {
      setSwapManualSelect(item);
      navigation.pop();
    },
    [navigation, setSwapManualSelect],
  );
  const renderItem = useCallback(
    ({ item }: { item: IFetchQuoteResult; index: number }) => {
      let disabled = !item.toAmount;
      const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
      if (item.limit) {
        if (item.limit.min) {
          const minBN = new BigNumber(item.limit.min);
          if (fromTokenAmountBN.lt(minBN)) {
            disabled = false;
          }
        }
        if (item.limit.max) {
          const maxBN = new BigNumber(item.limit.max);
          if (fromTokenAmountBN.gt(maxBN)) {
            disabled = false;
          }
        }
      }
      return (
        <SwapProviderListItem
          onPress={
            !disabled
              ? () => {
                  onSelectQuote(item);
                }
              : undefined
          }
          selected={Boolean(
            item.info.provider === currentSelectQuote?.info.provider &&
              item.info.providerName === currentSelectQuote?.info.providerName,
          )}
          fromTokenAmount={fromTokenAmount}
          fromToken={fromToken}
          toToken={toToken}
          providerResult={item}
          currencySymbol={settingsPersist.currencyInfo.symbol}
          disabled={disabled}
        />
      );
    },
    [
      currentSelectQuote?.info.provider,
      currentSelectQuote?.info.providerName,
      fromToken,
      fromTokenAmount,
      onSelectQuote,
      settingsPersist.currencyInfo.symbol,
      toToken,
    ],
  );

  const rightInfoComponent = useCallback(
    () => (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.provider_ios_popover_title,
        })}
        renderTrigger={
          <IconButton
            variant="tertiary"
            size="medium"
            icon="InfoCircleOutline"
          />
        }
        renderContent={
          <Stack p="$5" gap="$6">
            <Stack gap="$3">
              <Stack gap="$1">
                <SizableText size="$headingMd" color="$text">
                  {intl.formatMessage({
                    id: ETranslations.provider_ios_popover_order_info_title,
                  })}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.provider_popover_order_info_content,
                  })}
                </SizableText>
              </Stack>
              <InformationItem
                icon="LockOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_ios_popover_approval_require_msg,
                })}
              />
              <InformationItem
                icon="GasOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_network_fee,
                })}
              />
              <InformationItem
                icon="ClockTimeHistoryOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_swap_duration,
                })}
              />
              <InformationItem
                icon="HandCoinsOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_protocol_fee,
                })}
              />
            </Stack>
          </Stack>
        }
      />
    ),
    [intl],
  );
  return (
    <Page>
      <Page.Header headerRight={rightInfoComponent} />
      <SectionList
        px="$5"
        pt="$2"
        pb="$4"
        estimatedItemSize="$10"
        renderItem={renderItem}
        sections={sectionData}
        renderSectionHeader={({ section: { type, title } }) => {
          if (type === ESwapProviderStatus.AVAILABLE) {
            return (
              <Select
                title={intl.formatMessage({
                  id: ETranslations.provider_sort_title,
                })}
                items={swapProviderSortSelectItems}
                onChange={onSelectSortChange}
                value={providerSort}
                renderTrigger={({ value, label, placeholder }) => (
                  <Button
                    mt="$1"
                    alignSelf="flex-start"
                    variant="tertiary"
                    icon="FilterSortSolid"
                    iconAfter="ChevronDownSmallOutline"
                  >
                    <SizableText size="$bodyMd">
                      {value ? label : placeholder}
                    </SizableText>
                  </Button>
                )}
              />
            );
          }
          return <SectionList.SectionHeader title={title} px="$0" />;
        }}
      />
    </Page>
  );
};

const SwapProviderSelectModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapProviderSelect>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapProviderSelectModal />
    </SwapProviderMirror>
  );
};

export default SwapProviderSelectModalWithProvider;
