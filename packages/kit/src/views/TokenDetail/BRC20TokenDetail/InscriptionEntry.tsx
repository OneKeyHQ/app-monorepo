import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Image,
  Pressable,
  Text,
  VStack,
} from '@onekeyhq/components';
import OrdinalLogo from '@onekeyhq/kit/assets/Ordinal.png';

import type { BRC20TokenAmountItem } from '../../Send/types';

type Props = {
  amountList: BRC20TokenAmountItem[];
  style?: ComponentProps<typeof Box>;
};

function InscriptionEntry(props: Props) {
  const intl = useIntl();
  const { style, amountList } = props;

  return (
    <Box {...style}>
      <Pressable.Item borderRadius="18px">
        <HStack space={2} alignItems="center">
          <Image source={OrdinalLogo} size="40px" />
          <VStack flex={1}>
            <Text typography="Body1Strong">Manage Inscriptions</Text>
            <Text typography="Body2" color="text-subdued">
              {intl.formatMessage(
                { id: 'content__int_items' },
                { '0': amountList.length ?? '0' },
              )}
            </Text>
          </VStack>
          <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
        </HStack>
      </Pressable.Item>
    </Box>
  );
}

export { InscriptionEntry };
