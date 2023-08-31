import { type ComponentProps, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Skeleton,
  Text,
  VStack,
} from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';

import OrdinalsSVG from '../../../components/SVG/OrdinalsSVG';

type Props = {
  inscriptions: NFTBTCAssetModel[] | undefined;
  isLoadingInscriptions: boolean;
  onPress: () => void;
  style?: ComponentProps<typeof Box>;
};

function InscriptionEntry(props: Props) {
  const intl = useIntl();
  const { style, inscriptions, onPress, isLoadingInscriptions } = props;

  const isDisabled = useMemo(
    () => !inscriptions?.length || isLoadingInscriptions,
    [inscriptions?.length, isLoadingInscriptions],
  );

  return (
    <Box {...style}>
      <Pressable.Item
        borderRadius="18px"
        isDisabled={isDisabled}
        onPress={onPress}
        borderWidth={1}
        borderColor="border-default"
      >
        <HStack space={2} alignItems="center">
          <OrdinalsSVG width={40} height={40} />
          <VStack flex={1}>
            <Text typography="Body1Strong">
              {intl.formatMessage({ id: 'title__manage_inscriptions' })}
            </Text>
            {isLoadingInscriptions ? (
              <Skeleton shape="Body2" />
            ) : (
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage(
                  { id: 'content__int_items' },
                  { '0': inscriptions?.length ?? '0' },
                )}
              </Text>
            )}
          </VStack>
          {!isDisabled && (
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          )}
        </HStack>
      </Pressable.Item>
    </Box>
  );
}

export { InscriptionEntry };
