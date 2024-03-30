import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import type {
  IBadgeType,
  IScrollViewProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  Badge,
  Empty,
  Icon,
  Image,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ImageSource } from '@onekeyhq/components/src/primitives/Image/ImageSource';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../../../types';

const chunkArray = (array: ICategory['dapps'], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

function ItemsContainer({
  children,
  ...rest
}: {
  children: ReactNode;
} & IStackProps &
  IScrollViewProps) {
  const media = useMedia();

  if (media.gtMd) {
    return <Stack {...rest}>{children}</Stack>;
  }

  return (
    <ScrollView showsHorizontalScrollIndicator={false} {...rest}>
      {children}
    </ScrollView>
  );
}

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
      <ItemsContainer key={categoryId} mx="$-5">
        <XStack
          px="$2"
          $md={{
            flexDirection: 'column',
          }}
          $gtMd={{
            flexDirection: 'column',
          }}
        >
          {dataChunks.map((chunk, chunkIndex) => (
            <Stack
              key={chunkIndex}
              $md={{
                flexDirection: 'row',
                flexWrap: 'wrap',
              }}
              $gtMd={{
                flexDirection: 'row',
                flexWrap: 'wrap',
              }}
            >
              {chunk.map((item) => (
                <XStack
                  key={item.dappId}
                  p="$3"
                  space="$3"
                  alignItems="center"
                  $md={{
                    flexBasis: '50%',
                  }}
                  $gtMd={{
                    flexBasis: '50%',
                  }}
                  $gtLg={{
                    flexBasis: '33.3333%',
                  }}
                  onPress={() => {
                    handleOpenWebSite({
                      webSite: {
                        url: item.url,
                        title: item.name,
                      },
                    });
                  }}
                >
                  <Image w="$14" h="$14" borderRadius="$3">
                    <Image.Source
                      source={{
                        uri: item.logo,
                      }}
                    />
                  </Image>
                  <Stack flex={1}>
                    <XStack alignItems="center">
                      <SizableText
                        size="$bodyLgMedium"
                        $md={{
                          size: '$bodyMdMedium',
                        }}
                        $gtMd={{
                          size: '$bodyMdMedium',
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </SizableText>
                      {Array.isArray(item.tags) && item.tags.length ? (
                        <Badge
                          badgeSize="sm"
                          badgeType={item.tags[0].type as IBadgeType}
                          ml="$2"
                        >
                          {item.tags[0].name}
                        </Badge>
                      ) : null}
                    </XStack>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      $gtMd={{
                        size: '$bodySm',
                        numberOfLines: 2,
                        whiteSpace: 'break-spaces',
                      }}
                    >
                      {item.description}
                    </SizableText>
                  </Stack>
                </XStack>
              ))}
            </Stack>
          ))}
        </XStack>
      </ItemsContainer>
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
