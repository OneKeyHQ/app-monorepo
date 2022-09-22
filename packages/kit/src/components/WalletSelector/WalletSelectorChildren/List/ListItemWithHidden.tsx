import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text, VStack } from '@onekeyhq/components';

import { showOverlay } from '../../../../utils/overlayUtils';
import CreateHwWalletDialog from '../../../../views/CreateWallet/HardwareWallet/CreateHwWalletDialog';
import { useIsPassphraseMode } from '../../hooks/useIsPassphraseMode';

import ListItem from './ListItem';

import type { IHardwareDeviceStatusMap } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { IWalletDataBase } from './index';

function ListItemWithHidden({
  deviceStatus,
  item,
}: {
  item: IWalletDataBase;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  const intl = useIntl();
  const isPassphraseMode = useIsPassphraseMode(item);

  const onAddPassphraseWallet = useCallback((deviceId: string) => {
    showOverlay((onClose) => (
      <CreateHwWalletDialog
        deviceId={deviceId}
        onlyPassphrase
        onClose={onClose}
      />
    ));
  }, []);

  return (
    <>
      {/* Grouping wallet items if they have nested hidden wallets */}
      {isPassphraseMode ? (
        <VStack space={1} rounded="16px" bgColor="surface-subdued">
          <ListItem deviceStatus={deviceStatus} {...item} />
          {item.hiddenWallets?.map((hiddenWallet, index) => (
            <ListItem
              {...item}
              key={index}
              deviceStatus={deviceStatus}
              wallet={hiddenWallet}
            />
          ))}
          <Box p={2}>
            <Pressable
              // TODO hidden wallet add
              rounded="xl"
              flexDirection="row"
              alignItems="center"
              justifyContent="center"
              p={2}
              borderWidth={1}
              borderColor="border-default"
              borderStyle="dashed"
              _hover={{ bgColor: 'surface-hovered' }}
              _pressed={{ bgColor: 'surface-pressed' }}
              onPress={() => {
                const associatedDevice =
                  item?.wallet?.associatedDevice ??
                  item?.hiddenWallets?.[0]?.associatedDevice;

                if (associatedDevice) {
                  onAddPassphraseWallet(associatedDevice);
                }
              }}
            >
              <Icon name="PlusSmSolid" size={20} />
              <Text ml={2} typography="Body2Strong">
                {intl.formatMessage({ id: 'action__add_hidden_wallet' })}
              </Text>
            </Pressable>
          </Box>
        </VStack>
      ) : (
        <ListItem deviceStatus={deviceStatus} {...item} />
      )}
    </>
  );
}

export { ListItemWithHidden };
