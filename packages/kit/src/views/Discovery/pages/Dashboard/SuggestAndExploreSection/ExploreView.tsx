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
        networks: IServerNetwork[];
      }
    | undefined;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedNetwork: string;
  setSelectedNetwork: Dispatch<SetStateAction<string>>;
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
  const networkOptions = useMemo(
    () =>
      Array.isArray(categoryResult?.networks)
        ? categoryResult.networks.map((i) => ({
            value: i.id,
            label: i.name,
            logoURI: i.logoURI,
          }))
        : [],
    [categoryResult?.networks],
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
        <Select
          title="Categories"
          items={networkOptions}
          value={selectedNetwork}
          onChange={setSelectedNetwork}
          renderTrigger={({ label, value }) => (
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
            >
              <Image w="$5" h="$5">
                <ImageSource
                  source={{
                    uri:
                      networkOptions.find((i) => i.value === value)?.logoURI ??
                      '',
                  }}
                />
              </Image>
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
