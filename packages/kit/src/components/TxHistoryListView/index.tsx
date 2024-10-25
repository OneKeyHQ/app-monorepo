import { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import type { IListViewProps } from '@onekeyhq/components';
import {
  SectionList,
  SizableText,
  Stack,
  XStack,
  renderNestedScrollView,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  convertToSectionGroups,
  getFilteredHistoryBySearchKey,
} from '@onekeyhq/shared/src/utils/historyUtils';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useTabListScroll } from '../../hooks/useTabListScroll';
import { useSearchKeyAtom } from '../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { EmptySearch } from '../Empty';
import { EmptyHistory } from '../Empty/EmptyHistory';
import { HistoryLoadingView } from '../Loading';

import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';

type IProps = {
  data: IAccountHistoryTx[];
  isLoading?: boolean;
  tableLayout?: boolean;
  ListHeaderComponent?: ReactElement;
  showHeader?: boolean;
  showIcon?: boolean;
  onPressHistory?: (history: IAccountHistoryTx) => void;
  initialized?: boolean;
  inTabList?: boolean;
  contentContainerStyle?: IListViewProps<IAccountHistoryTx>['contentContainerStyle'];
  hideValue?: boolean;
};

const ListFooterComponent = () => {
  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );
  return (
    <>
      <Stack h="$5" />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </>
  );
};

function TxHistoryListViewSectionHeader(props: IHistoryListSectionGroup) {
  const { title, titleKey, data } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';

  if (data[0] && data[0].decodedTx.status === EDecodedTxStatus.Pending) {
    return (
      <XStack h="$9" px="$5" alignItems="center" bg="$bgApp" space="$2">
        <Stack
          w="$2"
          height="$2"
          backgroundColor="$textCaution"
          borderRadius="$full"
        />
        <SizableText numberOfLines={1} size="$headingSm" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_pending })}
        </SizableText>
      </XStack>
    );
  }

  return <SectionList.SectionHeader title={titleText} />;
}

function TxHistoryListView(props: IProps) {
  const {
    data,
    isLoading,
    showHeader,
    ListHeaderComponent,
    showIcon,
    onPressHistory,
    tableLayout,
    initialized,
    contentContainerStyle,
    inTabList = false,
    hideValue,
  } = props;

  const [searchKey] = useSearchKeyAtom();

  const filteredHistory = getFilteredHistoryBySearchKey({
    history: data,
    searchKey,
  });

  const sections = useMemo(
    () =>
      convertToSectionGroups({
        items: filteredHistory,
        formatDate: (date: number) =>
          formatDate(new Date(date), {
            hideTimeForever: true,
          }),
      }),
    [filteredHistory],
  );

  const renderItem = useCallback(
    (info: { item: IAccountHistoryTx; index: number }) => (
      <TxHistoryListItem
        hideValue={hideValue}
        index={info.index}
        historyTx={info.item}
        showIcon={showIcon}
        onPress={onPressHistory}
        tableLayout={tableLayout}
      />
    ),
    [hideValue, onPressHistory, showIcon, tableLayout],
  );
  const renderSectionHeader = useCallback(
    ({
      section: { title, titleKey, data: tx },
    }: {
      section: IHistoryListSectionGroup;
    }) => (
      <TxHistoryListViewSectionHeader
        title={title}
        titleKey={titleKey}
        data={tx}
      />
    ),
    [],
  );

  const { listViewProps, listViewRef, onLayout } =
    useTabListScroll<IAccountHistoryTx>({
      inTabList,
    });

  if (!initialized && isLoading) {
    return (
      <Stack py="$3" {...contentContainerStyle}>
        {ListHeaderComponent}
        <HistoryLoadingView tableLayout={tableLayout} />
      </Stack>
    );
  }

  return (
    <SectionList
      {...(listViewProps as any)}
      renderScrollComponent={renderNestedScrollView}
      ref={listViewRef}
      contentContainerStyle={{
        ...contentContainerStyle,
      }}
      h="100%"
      onLayout={onLayout}
      sections={sections}
      ListEmptyComponent={searchKey ? EmptySearch : EmptyHistory}
      estimatedItemSize={platformEnv.isNative ? 60 : 56}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={(tx, index) =>
        (tx as IAccountHistoryTx).id || index.toString(10)
      }
      {...(showHeader &&
        data?.length > 0 && {
          ListHeaderComponent: (
            <TxHistoryListHeader filteredHistory={filteredHistory} />
          ),
        })}
    />
  );
}

export { TxHistoryListView };
