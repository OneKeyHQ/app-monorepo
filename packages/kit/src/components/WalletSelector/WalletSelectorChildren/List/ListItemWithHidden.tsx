import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text, VStack } from '@onekeyhq/components';
import { isPassphraseWallet } from '@onekeyhq/engine/src/engineUtils';

import { useAppSelector } from '../../../../hooks';
import { showOverlay } from '../../../../utils/overlayUtils';
import CreateHwWalletDialog from '../../../../views/CreateWallet/HardwareWallet/CreateHwWalletDialog';

import ListItem from './ListItem';

import type { IHardwareDeviceStatusMap } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { IWalletDataBase } from './index';

// TODO move to standalone files
function useIsPassphraseMode(item: IWalletDataBase) {
  const passphraseOpenedList = useAppSelector(
    (state) => state.hardware.passphraseOpened,
  );
  const isPassphraseMode = useMemo(() => {
    const deviceId = item?.wallet?.associatedDevice || '';
    if (passphraseOpenedList.find((v) => v && v === deviceId)) {
      return true;
    }
    if (item?.hiddenWallets?.find((w) => isPassphraseWallet(w))) {
      return true;
    }
    return false;
  }, [
    passphraseOpenedList,
    item?.hiddenWallets,
    item?.wallet?.associatedDevice,
  ]);
  return isPassphraseMode;
}

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
                if (item?.wallet?.associatedDevice) {
                  onAddPassphraseWallet(item?.wallet?.associatedDevice);
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
