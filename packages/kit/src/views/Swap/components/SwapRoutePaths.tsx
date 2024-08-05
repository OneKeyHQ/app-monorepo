import { memo } from 'react';

import { SizableText, Stack, XStack } from '@onekeyhq/components';

import { Token } from '../../../components/Token';

interface ISwapRoutePathProps {
  routeContent: IRouteRows | string;
}

interface IRouteItem {
  images: { logoImageUri?: string }[];
  label: string;
}

type IRouteRow = IRouteItem[];

export type IRouteRows = IRouteRow[];
const SwapRoutePaths = ({ routeContent }: ISwapRoutePathProps) => (
  <Stack pt="$3.5">
    {typeof routeContent === 'string' ? (
      <SizableText size="$bodySm" color="$textSubdued">
        {routeContent}
      </SizableText>
    ) : null}

    {Array.isArray(routeContent) ? (
      <>
        {routeContent.map((row, rowIndex) => (
          <XStack
            key={rowIndex}
            {...(rowIndex !== 0 && { mt: '$3.5' })}
            justifyContent="space-between"
          >
            <XStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              h="$3.5"
              alignItems="flex-end"
              gap="$1"
            >
              {/* generate a array with 40 empty fill */}
              <XStack px="$4" flex={1} gap="$1" alignItems="center">
                {new Array(40).fill(null).map((_, index) => (
                  <Stack key={index} h="$0.5" bg="$borderSubdued" flex={1} />
                ))}
              </XStack>
            </XStack>
            {row.map((item, itemIndex) => {
              const maxWidth = `$${4 + 4 * item.images.length}`;
              return (
                <Stack key={itemIndex} alignItems="center">
                  <XStack bg="$bgApp" maxWidth={maxWidth}>
                    {item.images.map((image, index) => (
                      <Token
                        key={index}
                        size="sm"
                        tokenImageUri={image.logoImageUri}
                        {...(index !== 0 && {
                          ml: '$-2.5',
                        })}
                      />
                    ))}
                  </XStack>
                  <Stack maxWidth="$16" $gtMd={{ maxWidth: '$24' }}>
                    <SizableText
                      pt="$1.5"
                      size="$bodySmMedium"
                      color="$textSubdued"
                      numberOfLines={1}
                    >
                      {item.label}
                    </SizableText>
                  </Stack>
                </Stack>
              );
            })}
          </XStack>
        ))}
      </>
    ) : null}
  </Stack>
);

export default memo(SwapRoutePaths);
