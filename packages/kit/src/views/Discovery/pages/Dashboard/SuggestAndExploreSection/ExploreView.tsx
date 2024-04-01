import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import {
  Empty,
  Icon,
  Image,
  Select,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ImageSource } from '@onekeyhq/components/src/primitives/Image/ImageSource';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import { ChunkedItemsView, chunkArray } from './ChunkedItemsView';

import type { IMatchDAppItemType } from '../../../types';

export function ExploreView({
  dAppList,
  categoryResult,
  handleOpenWebSite,
  selectedCategory,
  setSelectedCategory,
  selectedNetwork,
  setSelectedNetwork,
}: {
  dAppList:
    | {
        data: IDApp[];
        next: string;
      }
    | undefined;
  categoryResult:
    | {
        categoryList: ICategory[];
      }
    | undefined;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedNetwork: IServerNetwork | undefined;
  setSelectedNetwork: Dispatch<SetStateAction<IServerNetwork | undefined>>;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const media = useMedia();
  const chunkSize = useMemo(() => {
    if (!media.gtMd) {
      return 2;
    }
    return media.lg ? 2 : 3;
  }, [media]);

  const selectOptions = useMemo(
    () =>
      Array.isArray(categoryResult?.categoryList)
        ? categoryResult.categoryList.map((i) => ({
            value: i.categoryId,
            label: i.name,
          }))
        : [],
    [categoryResult?.categoryList],
  );
  const isEmpty = !dAppList?.data || dAppList?.data.length === 0;

  const renderChunkItemView = useCallback(
    (dataChunks: IDApp[][], categoryId: string) => (
      <ChunkedItemsView
        key={categoryId}
        isExploreView
        dataChunks={dataChunks}
        handleOpenWebSite={handleOpenWebSite}
      />
    ),
    [handleOpenWebSite],
  );
  const openChainSelector = useConfigurableChainSelector();
  return (
    <>
      <XStack py="$2">
        <Select
          title="Categories"
          items={selectOptions}
          value={selectedCategory}
          onChange={setSelectedCategory}
          renderTrigger={({ label }) => (
            <XStack
              mr="$2.5"
              py="$1.5"
              px="$2"
              bg="$bgStrong"
              borderRadius="$3"
              userSelect="none"
              borderCurve="continuous"
              hoverStyle={{
                bg: '$bgStrongHover',
              }}
              pressStyle={{
                bg: '$bgStrongActive',
              }}
            >
              <SizableText size="$bodyMdMedium" px="$1">
                {label}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
        <XStack
          py="$1.5"
          px="$2"
          bg="$bgStrong"
          borderRadius="$3"
          userSelect="none"
          borderCurve="continuous"
          hoverStyle={{
            bg: '$bgStrongHover',
          }}
          pressStyle={{
            bg: '$bgStrongActive',
          }}
          onPress={() => {
            openChainSelector({
              onSelect: (network) => {
                if (!network) return;
                console.log('=====>', network);
                setSelectedNetwork(network);
              },
            });
          }}
        >
          <Image w="$5" h="$5">
            <ImageSource
              source={{
                uri: selectedNetwork?.logoURI ?? '',
              }}
            />
          </Image>
          <XStack maxWidth={119}>
            <SizableText size="$bodyMdMedium" px="$1" numberOfLines={1}>
              {selectedNetwork?.name ?? ''}
            </SizableText>
          </XStack>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
      </XStack>
      {isEmpty ? (
        <Empty icon="SearchOutline" title="No Results" />
      ) : (
        renderChunkItemView(
          chunkArray(dAppList?.data ?? [], chunkSize),
          selectedCategory,
        )
      )}
    </>
  );
}
