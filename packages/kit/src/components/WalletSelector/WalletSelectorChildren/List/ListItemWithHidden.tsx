import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';

import { showOverlay } from '../../../../utils/overlayUtils';
import CreateHwWalletDialog from '../../../../views/CreateWallet/HardwareWallet/CreateHwWalletDialog';
import { useIsPassphraseMode } from '../../hooks/useIsPassphraseMode';

import ListItem from './ListItem';

import type { IHardwareDeviceStatusMap } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { IWalletDataSection } from '../../hooks/useWalletSelectorSectionData';
import type { IWalletDataBase } from './index';

function ListItemWithHidden({
  devicesStatus,
  item,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  section,
  onLastItemRender,
}: {
  item: IWalletDataBase;
  section: IWalletDataSection;
  devicesStatus: IHardwareDeviceStatusMap | undefined;
  onLastItemRender?: () => void;
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

  // hide singleton wallet if no accounts
  if (item.isSingleton && !item.wallet?.accounts?.length) {
    return null;
  }

  return (
    <>
      {/* Grouping wallet items if they have nested hidden wallets */}
      {isPassphraseMode ? (
        <Box my="4px">
          <Box
            position="absolute"
            left="8px"
            top="0px"
            right="8px"
            bottom="0px"
            rounded="16px"
            borderWidth={1}
            borderColor="divider"
          />
          <ListItem
            onLastItemRender={onLastItemRender}
            devicesStatus={devicesStatus}
            {...item}
          />
          {item.hiddenWallets?.map((hiddenWallet, index) => (
            <>
              {index !== 0 ? <Box h={1} /> : null}
              <ListItem
                {...item}
                key={index}
                devicesStatus={undefined}
                wallet={hiddenWallet}
                onLastItemRender={onLastItemRender}
              />
            </>
          ))}
          <Box px={4} py={2}>
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
              <Icon name="PlusSmMini" size={20} />
              <Text ml={2} typography="Body2Strong">
                {intl.formatMessage({ id: 'action__add_hidden_wallet' })}
              </Text>
            </Pressable>
          </Box>
        </Box>
      ) : (
        <ListItem
          onLastItemRender={onLastItemRender}
          devicesStatus={devicesStatus}
          {...item}
        />
      )}
    </>
  );
}

export { ListItemWithHidden };
