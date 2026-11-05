import {
  type IStackProps,
  type IXStackProps,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';

import { type IListItemProps, ListItem } from '../ListItem';

// Desktop / web wallet rows: icon 40 + name and amount on the left, value and
// change on the right, the swap slot, and the same inset dividers, so nothing
// jumps when the rows arrive.
function WalletRowsLoading({
  listContainerProps,
  listCount = 6,
}: {
  listContainerProps?: IStackProps;
  listCount?: number;
}) {
  return (
    <Stack {...listContainerProps}>
      {[...Array(listCount)].map((_, index) => (
        <XStack
          key={index}
          position="relative"
          h={60}
          mx="$2"
          px="$3"
          gap="$3"
          alignItems="center"
        >
          <Skeleton w={40} h={40} radius="round" />
          <Stack flex={1} gap="$2">
            <Skeleton h="$4" w="$32" />
            <Skeleton h="$3" w="$24" />
          </Stack>
          <Stack alignItems="flex-end" gap="$2">
            <Skeleton h="$4" w="$16" />
            <Skeleton h="$3" w="$12" />
          </Stack>
          <Stack w={38} alignItems="center">
            <Skeleton w="$6" h="$6" radius="round" />
          </Stack>
          {index < listCount - 1 ? (
            <Stack
              position="absolute"
              left={64}
              right={0}
              bottom={0}
              h={1}
              bg="$bgStrong"
            />
          ) : null}
        </XStack>
      ))}
    </Stack>
  );
}

function ListLoading({
  isTokenSelectorView,
  walletRows,
  listContainerProps,
  listHeaderProps,
  itemProps,
  listCount,
}: {
  isTokenSelectorView?: boolean;
  walletRows?: boolean;
  itemProps?: IListItemProps;
  listContainerProps?: IStackProps;
  listHeaderProps?: IXStackProps;
  listCount?: number;
}) {
  if (walletRows) {
    return (
      <WalletRowsLoading
        listContainerProps={listContainerProps}
        listCount={listCount}
      />
    );
  }
  if (!isTokenSelectorView) {
    return (
      <Stack {...listContainerProps}>
        {/* Header */}
        <XStack
          gap="$3"
          py="$2"
          px="$5"
          $md={{
            display: 'none',
          }}
          {...listHeaderProps}
        >
          <XStack flexGrow={1} flexBasis={0} gap={89}>
            <Stack flexGrow={1} flexBasis={0} py="$1">
              <Skeleton h="$3" w="$12" />
            </Stack>
            <Stack flexGrow={1} flexBasis={0} py="$1">
              <Skeleton h="$3" w="$12" />
            </Stack>
          </XStack>
          <Stack w="$8" />
          <XStack flexGrow={1} flexBasis={0}>
            <Stack flexGrow={1} flexBasis={0} py="$1">
              <Skeleton h="$3" w="$12" />
            </Stack>
            <Stack flexGrow={1} flexBasis={0} py="$1" alignItems="flex-end">
              <Skeleton h="$3" w="$12" />
            </Stack>
          </XStack>
        </XStack>

        {/* Items */}
        {[...Array(listCount ?? 5)].map((_, index) => (
          <ListItem key={index} {...itemProps}>
            <Stack>
              <Skeleton
                radius="round"
                w="$10"
                h="$10"
                $gtLg={{
                  w: '$8',
                  h: '$8',
                }}
              />
            </Stack>
            <Stack
              flexGrow={1}
              flexBasis={0}
              $gtLg={{
                flexDirection: 'row',
              }}
            >
              <Stack
                py="$1"
                $gtLg={{
                  flexGrow: 1,
                  flexBasis: 0,
                }}
              >
                <Skeleton
                  h="$4"
                  $gtLg={{
                    h: '$3',
                  }}
                  w="$32"
                />
              </Stack>
              <Stack
                py="$1"
                $gtLg={{
                  flexGrow: 1,
                  flexBasis: 0,
                }}
              >
                <Skeleton h="$3" w="$24" />
              </Stack>
            </Stack>
            <Stack
              flexGrow={1}
              flexBasis={0}
              $gtLg={{
                flexDirection: 'row',
              }}
            >
              <Stack
                alignItems="flex-end"
                py="$1"
                $gtLg={{
                  alignItems: 'flex-start',
                  flexGrow: 1,
                  flexBasis: 0,
                }}
              >
                <Skeleton
                  h="$4"
                  $gtLg={{
                    h: '$3',
                  }}
                  w="$16"
                />
              </Stack>
              <Stack
                alignItems="flex-end"
                py="$1"
                $gtLg={{
                  flexGrow: 1,
                  flexBasis: 0,
                }}
              >
                <Skeleton h="$3" w="$12" />
              </Stack>
            </Stack>
          </ListItem>
        ))}
      </Stack>
    );
  }

  return (
    <Stack {...listContainerProps}>
      {[...Array(listCount ?? 3)].map((_, index) => (
        <ListItem key={index} {...itemProps}>
          <Stack>
            <Skeleton radius="round" w="$10" h="$10" />
          </Stack>
          <Stack>
            <Stack py="$1">
              <Skeleton
                h="$4"
                $gtLg={{
                  h: '$3',
                }}
                w="$32"
              />
            </Stack>
            <Stack py="$1">
              <Skeleton h="$3" w="$24" />
            </Stack>
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

function NFTListLoadingView() {
  return (
    <XStack flexWrap="wrap">
      {[...Array(6)].map((_, index) => (
        <Stack
          key={index}
          flexBasis="50%"
          $gtSm={{
            flexBasis: '33.333333%',
          }}
          $gtLg={{
            flexBasis: '25%',
          }}
          $gtXl={{
            flexBasis: '16.666666%',
          }}
          $gt2xl={{
            flexBasis: '14.2857142857%',
          }}
          p="$2.5"
          borderRadius="$4"
        >
          <Stack pb="100%">
            <Stack position="absolute" left={0} top={0} right={0} bottom={0}>
              <Skeleton w="100%" h="100%" borderRadius="$2.5" />
            </Stack>
          </Stack>
          <Stack mt="$2">
            <Stack py="$1">
              <Skeleton h="$4" w="$16" />
            </Stack>
            <Stack py="$1">
              <Skeleton h="$3" w="$12" />
            </Stack>
          </Stack>
        </Stack>
      ))}
    </XStack>
  );
}

function HistoryLoadingView({ tableLayout }: { tableLayout?: boolean }) {
  if (tableLayout) {
    return (
      <Stack py="$3">
        <Stack px="$pagePadding" py="$2">
          <Skeleton.BodySm />
        </Stack>
        {[...Array(3)].map((_, index) => (
          <ListItem key={index} py="$3">
            <XStack flexGrow={1} flexBasis={0} gap="$3">
              <Skeleton radius="round" w="$10" h="$10" />
              <Stack gap="$1">
                <Skeleton.BodyMd />
                <Skeleton.BodyMd />
              </Stack>
            </XStack>
            <Stack flexGrow={1} flexBasis={0} gap="$1">
              <Skeleton.BodyMd />
              <Skeleton.BodyMd />
            </Stack>
            <Stack flexGrow={0.6} flexBasis={0} gap="$1">
              <Skeleton.BodyMd />
              <Skeleton.BodyMd />
            </Stack>
          </ListItem>
        ))}
      </Stack>
    );
  }

  return (
    <Stack py="$3">
      {[...Array(3)].map((_, index) => (
        <ListItem key={index}>
          <XStack flexGrow={1} flexBasis={0} gap="$3">
            <Stack>
              <Skeleton radius="round" w="$10" h="$10" />
            </Stack>
            <Stack>
              <Stack py="$1">
                <Skeleton h="$4" w="$32" />
              </Stack>
              <Stack py="$1">
                <Skeleton h="$3" w="$24" />
              </Stack>
            </Stack>
          </XStack>
          <Stack flexGrow={1} flexBasis={0}>
            <Stack alignItems="flex-end" py="$1">
              <Skeleton h="$4" w="$16" />
            </Stack>
            <Stack alignItems="flex-end" py="$1">
              <Skeleton h="$3" w="$12" />
            </Stack>
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

export { ListLoading, NFTListLoadingView, HistoryLoadingView };
