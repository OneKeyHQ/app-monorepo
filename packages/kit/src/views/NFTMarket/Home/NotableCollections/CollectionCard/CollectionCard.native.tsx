import type { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, NetImage, Pressable, Text } from '@onekeyhq/components';

import PriceText from '../../../PriceText';

interface CollectionCardProps extends ComponentProps<typeof Pressable> {
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
    <Pressable {...rest}>
      <Box borderRadius="12px" overflow="hidden">
        <NetImage width="280px" height="280px" {...netImageProps} />
      </Box>
      <Box mt="8px" width="280px" flexDirection="row" alignItems="center">
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
    </Pressable>
  );
};

CollectionCard.displayName = 'CollectionCard';

export default CollectionCard;
