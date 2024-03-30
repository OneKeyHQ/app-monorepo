import { useCallback, useMemo } from 'react';

import { Heading, Stack, useMedia } from '@onekeyhq/components';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import { ChunkedItemsView, chunkArray } from './ChunkedItemsView';

import type { IMatchDAppItemType } from '../../../types';

export function SuggestedView({
  suggestedData,
  handleOpenWebSite,
}: {
  suggestedData: ICategory[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const media = useMedia();
  const chunkSize = media.gtMd && media.lg ? 2 : 3;
  const chunkedSuggestedData = useMemo(
    () =>
      suggestedData.map((i) => ({
        ...i,
        dataChunks: chunkArray(i.dapps, chunkSize),
      })),
    [suggestedData, chunkSize],
  );

  const renderChunkItemView = useCallback(
    (dataChunks: IDApp[][], categoryId: string) => (
      <ChunkedItemsView
        key={categoryId}
        dataChunks={dataChunks}
        handleOpenWebSite={handleOpenWebSite}
      />
    ),
    [handleOpenWebSite],
  );

  return (
    <>
      {chunkedSuggestedData.map((i, index) => (
        <Stack key={`${i.name}--${i.categoryId}`}>
          <Heading
            size="$headingMd"
            pt="$2"
            {...(index !== 0 && {
              pt: '$5',
            })}
          >
            {i.name}
          </Heading>
          {renderChunkItemView(i.dataChunks, i.categoryId)}
        </Stack>
      ))}
    </>
  );
}
