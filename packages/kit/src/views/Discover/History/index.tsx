import type { FC } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  IconButton,
  Modal,
  Pressable,
  Searchbar,
  Typography,
} from '@onekeyhq/components';

import { useNavigation, useTranslation } from '../../../hooks';
import useFormatDate from '../../../hooks/useFormatDate';
import FavListMenu from '../../Overlay/Discover/FavListMenu';
import DAppIcon from '../components/DAppIcon';
import { openMatchDApp } from '../Explorer/Controller/gotoSite';
import { useUserBrowserHistories } from '../hooks';
import { getUrlHost } from '../utils';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { SectionListData, SectionListProps } from 'react-native';

const ItemSeparatorComponent = () => <Box h="4" />;

type HistoryItemBoxProps = { item: MatchDAppItemType };

const HistoryItemBox: FC<HistoryItemBoxProps> = ({ item }) => {
  const t = useTranslation();
  const navigation = useNavigation();

  const onPress = useCallback(() => {
    openMatchDApp(item);
    navigation.goBack();
  }, [navigation, item]);
  const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
  const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
  const url = item.dapp?.url ?? item.webSite?.url;
  const networkIds = item.dapp?.networkIds;
  let description = 'Unknown';
  if (item.dapp) {
    description = t(item.dapp._subtitle) ?? item.dapp.subtitle;
  } else if (url) {
    description = getUrlHost(url);
  }

  return (
    <Pressable
      onPress={onPress}
      flexDirection="row"
      flex={1}
      alignItems="center"
      justifyContent="space-between"
    >
      <Box flexDirection="row" flex={1} alignItems="center">
        <DAppIcon
          key={logoURL}
          size={48}
          url={logoURL}
          networkIds={networkIds}
        />
        <Box flexDirection="column" ml="12px" flex={1}>
          <Typography.Body2Strong>{name}</Typography.Body2Strong>
          <Typography.Caption color="text-subdued" mt="4px" numberOfLines={1}>
            {description}
          </Typography.Caption>
        </Box>
      </Box>
      <FavListMenu item={item} isFav={false}>
        <IconButton type="plain" name="DotsHorizontalMini" />
      </FavListMenu>
    </Pressable>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      emoji="🕘"
      title={intl.formatMessage({ id: 'title__no_history' })}
      subTitle={intl.formatMessage({ id: 'title__no_history_desc' })}
    />
  );
};

const SearchContext = createContext<{
  text: string;
  setText: (text: string) => void;
}>({ text: '', setText: () => {} });

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { text, setText } = useContext(SearchContext);
  return (
    <Box w="full">
      <Searchbar
        w="full"
        size="xl"
        value={text}
        onChangeText={(word) => setText(word)}
        onClear={() => setText('')}
        placeholder={intl.formatMessage({ id: 'form__search' })}
      />
    </Box>
  );
};

function timestampLabel(value: number) {
  const date = new Date(value);
  return `${dateFormat(date, 'yyyy-MM-dd')}`;
}

type HistorySection = {
  title: string;
  data: MatchDAppItemType[];
};

export const History = () => {
  const [text, setText] = useState('');
  const { format } = useFormatDate();
  const ctx = useMemo(() => ({ text, setText }), [text, setText]);
  const intl = useIntl();
  const histories = useUserBrowserHistories();
  const renderItem: SectionListProps<
    MatchDAppItemType,
    HistorySection
  >['renderItem'] = useCallback(
    ({ item }) => <HistoryItemBox item={item} />,
    [],
  );
  const keyExtractor: SectionListProps<
    MatchDAppItemType,
    HistorySection
  >['keyExtractor'] = (item) => `${item.id}`;

  const renderSectionHeader: SectionListProps<
    MatchDAppItemType,
    HistorySection
  >['renderSectionHeader'] = useCallback(
    (item: { section: SectionListData<MatchDAppItemType, HistorySection> }) => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const labelForToday = dateFormat(today, 'yyyy-MM-dd');
      const labelForYesterday = dateFormat(yesterday, 'yyyy-MM-dd');
      let label = format(new Date(item.section.title), 'LLL dd yyyy');
      if (item.section.title === labelForToday) {
        label = intl.formatMessage({ id: 'content__today' });
      } else if (item.section.title === labelForYesterday) {
        label = intl.formatMessage({ id: 'content__yesterday' });
      }
      return (
        <Typography.Subheading py="4" color="text-subdued">
          {label}
        </Typography.Subheading>
      );
    },
    [format, intl],
  );

  const items = useMemo(() => {
    const key = text.trim().toLowerCase();
    if (!key) {
      return histories;
    }
    return histories.filter((o) => {
      const name = o.dapp?.name || o.webSite?.title || '';
      const url = o.dapp?.url || o.webSite?.title || '';
      return (
        name.toLowerCase().includes(key) || url.toLowerCase().includes(key)
      );
    });
  }, [text, histories]);

  const sections = useMemo(() => {
    const result: Record<string, MatchDAppItemType[]> = {};
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const title = timestampLabel(item.timestamp || Date.now());
      if (!result[title]) {
        result[title] = [] as MatchDAppItemType[];
      }
      result[title].push(item);
    }
    return Object.entries(result).map(([title, data]) => ({ title, data }));
  }, [items]);

  return (
    <SearchContext.Provider value={ctx}>
      <Modal
        header={intl.formatMessage({ id: 'transaction__history' })}
        footer={null}
        sectionListProps={{
          sections,
          // @ts-ignore
          renderItem,
          // @ts-ignore
          renderSectionHeader,
          // @ts-ignore
          keyExtractor,
          ListHeaderComponent,
          ListEmptyComponent,
          ItemSeparatorComponent,
        }}
      />
    </SearchContext.Provider>
  );
};
