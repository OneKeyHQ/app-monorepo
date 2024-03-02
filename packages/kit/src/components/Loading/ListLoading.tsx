import { Skeleton, Stack, XStack } from '@onekeyhq/components';

import { ListItem } from '../ListItem';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function ListLoading(props: IProps) {
  const { onContentSizeChange } = props;
  return (
    <Stack
      py="$3"
      onLayout={(event) =>
        onContentSizeChange?.(
          event.nativeEvent.layout.width,
          event.nativeEvent.layout.height,
        )
      }
    >
      {/* Header */}
      <XStack
        space="$3"
        py="$2"
        px="$5"
        $md={{
          display: 'none',
        }}
      >
        <XStack
          flexGrow={1}
          flexBasis={0}
          space={89}
          spaceDirection="horizontal"
        >
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
      {[...Array(5)].map((_, index) => (
        <ListItem key={index}>
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

function NFTListLoadingView(props: IProps) {
  const { onContentSizeChange } = props;

  return (
    <XStack
      p="$2.5"
      flexWrap="wrap"
      onLayout={(event) =>
        onContentSizeChange?.(
          event.nativeEvent.layout.width,
          event.nativeEvent.layout.height,
        )
      }
    >
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

export { ListLoading, NFTListLoadingView };
