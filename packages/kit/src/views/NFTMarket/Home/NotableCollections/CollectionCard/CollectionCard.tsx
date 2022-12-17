import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { MotiPressable } from 'moti/interactions';
import { useIntl } from 'react-intl';

import { Box, Icon, NetImage, Text } from '@onekeyhq/components';

import PriceText from '../../../PriceText';

interface CollectionCardProps extends ComponentProps<typeof MotiPressable> {
  netImageProps?: Partial<ComponentProps<typeof NetImage>>;
  priceTextProps?: Partial<ComponentProps<typeof PriceText>>;
  contractName?: string;
  verified?: boolean;
}

const CollectionCard: FC<CollectionCardProps> = ({
  contractName,
  priceTextProps,
  netImageProps,
  verified,
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
      <Box mt="8px" width="220px" flexDirection="row" alignItems="center">
        <Text mr="4px" typography="Body1Strong" isTruncated>
          {contractName}
        </Text>
        {!!verified && (
          <Icon name="BadgeCheckMini" size={16} color="icon-success" />
        )}
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
