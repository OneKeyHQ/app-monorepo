/* eslint-disable no-nested-ternary */
import React, { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Select,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { WalletAvatarPro } from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../../hooks/redux';
import { getWalletName } from '../../../hooks/useWalletName';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

import { CreateAccountButton } from './CreateAccountButton';

const { updateIsLoading } = reducerAccountSelector.actions;
function Header({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const {
    selectedNetwork,
    selectedNetworkId,
    isLoading,
    selectedWallet,
    selectedWalletId,
    isOpenDelay,
    preloadingCreateAccount,
  } = accountSelectorInfo;
  const { dispatch, serviceAccountSelector } = backgroundApiProxy;
  const close = useModalClose();
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { wallets } = useRuntime();
  const isFocused = useIsFocused();

  const walletsOptions = useMemo(() => {
    if (!isFocused || !isOpenDelay) {
      return [];
    }
    return wallets.map((wallet) => ({
      label: getWalletName({ wallet, intl }) || '-',
      value: wallet.id,
      wallet,
    }));
  }, [intl, isFocused, isOpenDelay, wallets]);

  const isPreloadingCreate = useMemo(
    () =>
      Boolean(
        preloadingCreateAccount?.walletId &&
          preloadingCreateAccount?.networkId &&
          preloadingCreateAccount?.walletId === selectedWalletId &&
          preloadingCreateAccount?.networkId === selectedNetworkId,
      ),
    [
      preloadingCreateAccount?.networkId,
      preloadingCreateAccount?.walletId,
      selectedNetworkId,
      selectedWalletId,
    ],
  );

  return (
    <Box pr={3.5}>
      <Box flexDirection="row" alignItems="center" pt={3.5} pb={2} pl={4}>
        <Box flexDirection="row" alignItems="center" flex={1} mr={3}>
          <Text typography="Heading" isTruncated>
            {selectedNetwork?.shortName || '-'}
          </Text>

          {isLoading ? (
            <Pressable
              ml={2}
              onPress={() => {
                dispatch(updateIsLoading(false));
              }}
            >
              <Spinner size="sm" />
            </Pressable>
          ) : null}
        </Box>

        <IconButton
          name="CloseSolid"
          type="plain"
          circle
          onPress={() => {
            close();
          }}
        />
      </Box>
      <Box flexDirection="row" alignItems="center" pl={2}>
        <Select
          title={intl.formatMessage({ id: 'title__wallets' })}
          footer={null}
          value={selectedWalletId}
          activatable={false}
          containerProps={{
            flex: 1,
            alignItems: 'flex-start',
          }}
          options={walletsOptions}
          renderTrigger={({ visible, onPress }) => (
            <Pressable minW="150px" onPress={onPress}>
              {({ isHovered, isPressed }) => (
                <Box
                  flexDirection="row"
                  p={2}
                  alignItems="center"
                  rounded="xl"
                  bgColor={
                    visible
                      ? 'surface-selected'
                      : isPressed
                      ? 'surface-pressed'
                      : isHovered
                      ? 'surface-hovered'
                      : undefined
                  }
                >
                  {selectedWallet ? (
                    <WalletAvatarPro
                      wallet={selectedWallet}
                      size="xs"
                      deviceStatus={undefined}
                    />
                  ) : null}
                  <Text typography="Body1Strong" mx={2} isTruncated>
                    {getWalletName({
                      wallet: selectedWallet,
                      intl,
                    })}
                  </Text>
                  <Icon name="SelectorSolid" size={20} />
                </Box>
              )}
            </Pressable>
          )}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          renderItem={(item, isActive, onChange) => (
            <>
              <Pressable
                onPress={async () => {
                  // call internal select onChange to make sure selector closed
                  onChange?.(item.value, item);
                  await serviceAccountSelector.updateSelectedWallet(item.value);
                }}
              >
                {({ isHovered, isPressed }) => (
                  <Box
                    p={2}
                    pr={{ base: 3, md: 2 }}
                    flexDirection="row"
                    alignItems="center"
                    bgColor={
                      isPressed
                        ? 'surface-pressed'
                        : isHovered
                        ? 'surface-hovered'
                        : undefined
                    }
                    rounded="xl"
                  >
                    {
                      // @ts-expect-error
                      item.wallet ? (
                        <WalletAvatarPro
                          // @ts-expect-error
                          wallet={item.wallet}
                          deviceStatus={undefined}
                          size={isVerticalLayout ? 'lg' : 'xs'}
                        />
                      ) : null
                    }

                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      flex={1}
                      mx={3}
                    >
                      {item.label}
                    </Text>
                    {isActive ? (
                      <Icon
                        name={isVerticalLayout ? 'CheckOutline' : 'CheckSolid'}
                        size={isVerticalLayout ? 24 : 20}
                        color="interactive-default"
                      />
                    ) : null}
                  </Box>
                )}
              </Pressable>
            </>
          )}
        />
        <CreateAccountButton
          walletId={selectedWalletId || ''}
          networkId={selectedNetworkId}
          isLoading={isPreloadingCreate}
        />
      </Box>
    </Box>
  );
}

export default Header;
