/* eslint-disable no-nested-ternary */
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Select,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../../../hooks/redux';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { getWalletName } from '../../../../hooks/useWalletName';
import { WalletAvatarPro } from '../../../WalletSelector/WalletAvatar';

import { CreateAccountButton } from './CreateAccountButton';

import type { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import type { IntlShape } from 'react-intl';

const buildData = debounce(
  ({
    setData,
    wallets,
    intl,
  }: {
    intl: IntlShape;
    wallets: IWallet[];
    setData: Dispatch<
      SetStateAction<{ label: string; value: string; wallet: IWallet }[]>
    >;
  }) => {
    const data = wallets.map((wallet) => ({
      label: getWalletName({ wallet, intl }) || '-',
      value: wallet.id,
      wallet,
    }));
    debugLogger.accountSelector.info(
      'rebuild NetworkAccountSelector walletList data',
    );
    setData(data);
  },
  150,
  {
    leading: false,
    trailing: true,
  },
);

export function WalletSelectDropdown({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const {
    selectedNetworkId,
    selectedWallet,
    selectedWalletId,
    isOpenDelay,
    isOpen,
    preloadingCreateAccount,
  } = accountSelectorInfo;
  const { serviceAccountSelector } = backgroundApiProxy;

  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { wallets } = useRuntime();
  const [data, setData] = useState<
    { label: string; value: string; wallet: IWallet }[]
  >([]);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (isMounted.current && isOpenDelay && isOpen) {
      buildData({
        wallets,
        setData,
        intl,
      });
    }
  }, [intl, isOpenDelay, isOpen, wallets, isMounted]);

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
    <>
      <Select
        title={intl.formatMessage({ id: 'title__wallets' })}
        footer={null}
        value={selectedWalletId}
        activatable={false}
        containerProps={{
          flex: 1,
          alignItems: 'flex-start',
        }}
        options={data}
        renderTrigger={({ visible, onPress }) => (
          <Pressable onPress={onPress}>
            {({ isHovered, isPressed }) => (
              <Box
                flexDirection="row"
                alignItems="center"
                maxW="240px"
                p={2}
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
                    devicesStatus={undefined}
                  />
                ) : null}
                <Text
                  typography="Body2Strong"
                  ml={2}
                  mr={1}
                  color="text-subdued"
                  isTruncated
                >
                  {getWalletName({
                    wallet: selectedWallet,
                    intl,
                  })}
                </Text>
                <Box>
                  <Icon
                    name="ChevronUpDownMini"
                    color="icon-subdued"
                    size={20}
                  />
                </Box>
              </Box>
            )}
          </Pressable>
        )}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        renderItem={(item, isActive, onChange) => (
          <Pressable
            key={item.value}
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
                      devicesStatus={undefined}
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
                    name={isVerticalLayout ? 'CheckOutline' : 'CheckMini'}
                    size={isVerticalLayout ? 24 : 20}
                    color="interactive-default"
                  />
                ) : null}
              </Box>
            )}
          </Pressable>
        )}
      />
      <CreateAccountButton
        walletId={selectedWalletId || ''}
        networkId={selectedNetworkId}
        isLoading={isPreloadingCreate}
      />
    </>
  );
}
