import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Text } from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import { showOverlay } from '../../utils/overlayUtils';

import { OverlayPanel } from './OverlayPanel';

import type { MessageDescriptor } from 'react-intl';

const SelectNFTPriceType: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
}) => {
  const intl = useIntl();
  const disPlayPriceType = useAppSelector((s) => s.nft.disPlayPriceType);

  const { serviceNFT } = backgroundApiProxy;

  const options: {
    id: MessageDescriptor['id'];
    selected: boolean;
  }[] = useMemo(
    () => [
      {
        id: 'form__last_price',
        selected: disPlayPriceType === 'lastSalePrice',
      },
      {
        id: 'form__floor_price',
        selected: disPlayPriceType === 'floorPrice',
      },
    ],
    [disPlayPriceType],
  );
  return (
    <Box bg="surface-subdued" flexDirection="column">
      {options.filter(Boolean).map(({ id, selected }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            serviceNFT.updatePriceType(
              id === 'form__last_price' ? 'lastSalePrice' : 'floorPrice',
            );
          }}
        >
          <Text typography="Body1Strong" ml="16px">
            {intl.formatMessage({
              id,
            })}
          </Text>
          {selected && <Icon name="CheckOutline" color="interactive-default" />}
        </PressableItem>
      ))}
    </Box>
  );
};

export const showSelectNFTPriceType = () =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      closeOverlay={closeOverlay}
      modalProps={{
        header: formatMessage({ id: 'action__more' }),
      }}
    >
      <SelectNFTPriceType closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
