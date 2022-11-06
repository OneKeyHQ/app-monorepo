import { ComponentProps, FC, useCallback } from 'react';

import { MotiPressable } from 'moti/interactions';
import { useIntl } from 'react-intl';

import { Box, NetImage, Text } from '@onekeyhq/components';

import PriceText from '../../../PriceText';

interface CollectionCardProps extends ComponentProps<typeof MotiPressable> {
  netImageProps?: Partial<ComponentProps<typeof NetImage>>;
  priceTextProps?: Partial<ComponentProps<typeof PriceText>>;
  contractName?: string;
}

const CollectionCard: FC<CollectionCardProps> = ({
  contractName,
  priceTextProps,
  netImageProps,
  ...rest
}) => {
  const intl = useIntl();

  return (
    <MotiPressable
      {...rest}
      animate={useCallback(
        ({ hovered }) => ({
          opacity: hovered ? 0.8 : 1,
        }),
        [],
      )}
    >
      <Box borderRadius="12px" overflow="hidden">
        <NetImage width="220px" height="147px" {...netImageProps} />
      </Box>
      <Box width="220px">
        <Text mt="8px" typography="Body1Strong" isTruncated>
          {contractName}
        </Text>
        {/* TODO 
          Verified Indicator here...
        */}
      </Box>
      <PriceText
        prefix={intl.formatMessage({
          id: 'content__floor',
        })}
        mt="4px"
        typography="Body2"
        color="text-subdued"
        {...priceTextProps}
      />
    </MotiPressable>
  );
};

CollectionCard.displayName = 'CollectionCard';

export default CollectionCard;
