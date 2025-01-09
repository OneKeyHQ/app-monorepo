import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Heading,
  IconButton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
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
        isExploreView={false}
        dataChunks={dataChunks}
        handleOpenWebSite={handleOpenWebSite}
      />
    ),
    [handleOpenWebSite],
  );
  const intl = useIntl();

  return (
    <>
      {chunkedSuggestedData.map((i, index) => (
        <Stack key={`${i.name}--${i.categoryId}`}>
          <XStack
            pt="$2"
            {...(index !== 0 && {
              pt: '$5',
            })}
            space="$1.5"
          >
            <Heading size="$headingMd" userSelect="none">
              {i.name}
            </Heading>
            {(i?.dappInfo?.information?.length ?? 0) > 0 ? (
              <IconButton
                alignSelf="center"
                icon="InfoCircleOutline"
                variant="tertiary"
                size="small"
                onPress={() => {
                  const dialog = Dialog.show({
                    icon: 'InfoCircleOutline',
                    title: i.name,
                    description: i?.dappInfo?.information,
                    onConfirmText: intl.formatMessage({
                      id: ETranslations.global_got_it,
                    }),
                    onCancelText: intl.formatMessage({
                      id: ETranslations.global_learn_more,
                    }),
                    showCancelButton: i?.dappInfo?.showLink ?? false,
                    cancelButtonProps: {
                      onPress: () => {
                        void dialog.close();
                        const link = i?.dappInfo?.link;
                        if (link) {
                          openUrlExternal(link);
                        }
                      },
                    },
                  });
                }}
              />
            ) : null}
          </XStack>
          {renderChunkItemView(i.dataChunks, i.categoryId)}
        </Stack>
      ))}
    </>
  );
}
