import { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  NetImage,
  Pressable,
  Text,
  useUserDevice,
} from '@onekeyhq/components';

import PriceText from '../../../PriceText';

interface CollectionCardProps extends ComponentProps<typeof Pressable> {
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
  const { screenWidth } = useUserDevice();

  return (
    <Pressable {...rest}>
      <Box borderRadius="12px" overflow="hidden">
        <NetImage
          width={`${screenWidth - 48}px`}
          height={`${screenWidth - 48}px`}
          {...netImageProps}
        />
      </Box>
      <Box width={`${screenWidth - 48}px`}>
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
    </Pressable>
  );
};

CollectionCard.displayName = 'CollectionCard';

export default CollectionCard;
