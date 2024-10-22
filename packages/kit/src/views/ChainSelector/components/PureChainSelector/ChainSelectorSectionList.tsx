import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  SearchBar,
  SectionList,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ISectionListProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFuseSearch } from '../../hooks/useFuseSearch';

import type { IServerNetworkMatch } from '../../types';

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
    />
  );
};

type ISectionListItem = {
  title?: string;
  data: IServerNetworkMatch[];
  isUnavailable?: boolean;
};

type IChainSelectorSectionListContentProps = {
  sections: ISectionListItem[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
};

const ChainSelectorSectionListContent = ({
  sections,
  onPressItem,
  networkId,
  initialScrollIndex,
}: IChainSelectorSectionListContentProps & {
  initialScrollIndex: ISectionListProps<any>['initialScrollIndex'];
}) => {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  const renderSectionHeader = useCallback(
    (item: { section: ISectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
      return <Stack />;
    },
    [],
  );

  return (
    <SectionList
      ListFooterComponent={<Stack h={bottom || '$2'} />}
      estimatedItemSize={48}
      sections={sections}
      keyExtractor={(item) => (item as IServerNetworkMatch).id}
      renderSectionHeader={renderSectionHeader}
      initialScrollIndex={initialScrollIndex}
      renderItem={({
        item,
        section,
      }: {
        item: IServerNetworkMatch;
        section: ISectionListItem;
      }) => (
        <ListItem
          h={48}
          renderAvatar={
            <NetworkAvatarBase
              logoURI={item.logoURI}
              isCustomNetwork={item.isCustomNetwork}
              networkName={item.name}
              size="$8"
            />
          }
          title={
            item.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : item.name
          }
          opacity={section.isUnavailable ? 0.7 : 1}
          titleMatch={item.titleMatch}
          onPress={
            !section.isUnavailable ? () => onPressItem?.(item) : undefined
          }
          testID={`select-item-${item.id}`}
        >
          {networkId === item.id ? (
            <ListItem.CheckMark key="checkmark" />
          ) : null}
        </ListItem>
      )}
    />
  );
};

type IChainSelectorSectionListProps = {
  networks: IServerNetworkMatch[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
  unavailable?: IServerNetworkMatch[];
};

const usePending = () => {
  const [isPending, setIsPending] = useState(false);
  const timerIdRef = useRef<ReturnType<typeof setTimeout>>();
  const clearPendingTimer = useCallback(() => {
    clearTimeout(timerIdRef.current);
    timerIdRef.current = setTimeout(() => {
      setIsPending(false);
    }, 50);
  }, []);
  const changeIsPending = useCallback(
    (pending: boolean) => {
      setIsPending(pending);
      if (pending) {
        clearPendingTimer();
      }
    },
    [clearPendingTimer],
  );
  useEffect(
    () => () => {
      clearTimeout(timerIdRef.current);
    },
    [],
  );
  return [isPending, changeIsPending] as ReturnType<typeof useState>;
};

export const ChainSelectorSectionList: FC<IChainSelectorSectionListProps> = ({
  networks,
  networkId,
  unavailable,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const intl = useIntl();
  const [isPending, setIsPending] = usePending();

  const onChangeText = useCallback(
    (value: string) => {
      setText(value.trim());
      setIsPending(true);
    },
    [setIsPending],
  );

  const networkFuseSearch = useFuseSearch(networks);

  const sections = useMemo<ISectionListItem[]>(() => {
    if (text) {
      const data = networkFuseSearch(text);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const testnetItems: IServerNetworkMatch[] = [];
    const mainnetItems: IServerNetworkMatch[] = [];
    for (let i = 0; i < networks.length; i += 1) {
      const item = networks[i];
      if (item.isTestnet) {
        testnetItems.push(item);
      } else {
        mainnetItems.push(item);
      }
    }

    const data = mainnetItems.reduce((acc, item) => {
      const char = item.name[0].toUpperCase();
      if (!acc[char]) {
        acc[char] = [];
      }
      acc[char].push(item);
      return acc;
    }, {} as Record<string, IServerNetworkMatch[]>);

    const mainnetSections = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: ISectionListItem[] = [...mainnetSections];

    if (testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: testnetItems,
      });
    }

    if (unavailable && unavailable.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.network_selector_unavailable_networks,
        }),
        data: unavailable,
        isUnavailable: true,
      });
    }

    return _sections;
  }, [networkFuseSearch, text, networks, intl, unavailable]);
  const initialScrollIndex = useMemo(() => {
    if (text.trim()) {
      return undefined;
    }
    let _initialScrollIndex:
      | { sectionIndex: number; itemIndex?: number }
      | undefined;
    sections.forEach((section, sectionIndex) => {
      section.data.forEach((item, itemIndex) => {
        if (item.id === networkId && _initialScrollIndex === undefined) {
          _initialScrollIndex = {
            sectionIndex,
            itemIndex: itemIndex - ((section?.title?.length ?? 0) > 0 ? 1 : 0),
          };
          if (
            _initialScrollIndex &&
            _initialScrollIndex.itemIndex !== undefined
          ) {
            // if (!platformEnv.isNative) {
            //   _initialScrollIndex.itemIndex += 1;
            // }
            const _itemIndex = _initialScrollIndex?.itemIndex ?? 0;
            if (_itemIndex === -1) {
              _initialScrollIndex.itemIndex = undefined;
            }
            if (
              _itemIndex === section.data.length &&
              sectionIndex !== sections.length - 1
            ) {
              _initialScrollIndex.sectionIndex += 1;
              _initialScrollIndex.itemIndex = undefined;
            }
          }
        }
      });
    });
    const initialScrollIndexNumber =
      sections
        .slice(0, _initialScrollIndex?.sectionIndex ?? 0)
        .reduce((prev, section) => prev + section.data.length + 3, 0) +
      (_initialScrollIndex?.itemIndex ?? 0) +
      1;
    if (
      _initialScrollIndex?.sectionIndex !== undefined &&
      initialScrollIndexNumber <= 7
    ) {
      return undefined;
    }
    return initialScrollIndexNumber;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, networkId, text]);

  const renderSections = useCallback(
    () =>
      sections.length ? (
        <ChainSelectorSectionListContent
          sections={sections}
          networkId={networkId}
          onPressItem={onPressItem}
          initialScrollIndex={initialScrollIndex}
        />
      ) : (
        <ListEmptyComponent />
      ),
    [initialScrollIndex, networkId, onPressItem, sections],
  );
  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          testID="chain-selector"
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      {/* Re-render the entire list after each text update */}
      {isPending ? null : renderSections()}
    </Stack>
  );
};
