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
              space="$1"
            >
              {/* generate a array with 40 empty fill */}
              {new Array(40).fill(null).map((_, index) => (
                <Stack key={index} h="$0.5" bg="$borderSubdued" flex={1} />
              ))}
            </XStack>
            {row.map((item, itemIndex) => (
              <Stack key={itemIndex} bg="$bgApp" alignItems="center">
                <XStack>
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
                <SizableText
                  pt="$1.5"
                  size="$bodySmMedium"
                  color="$textSubdued"
                >
                  {item.label}
                </SizableText>
              </Stack>
            ))}
          </XStack>
        ))}
      </>
    ) : null}
  </Stack>
);

export default memo(SwapRoutePaths);
