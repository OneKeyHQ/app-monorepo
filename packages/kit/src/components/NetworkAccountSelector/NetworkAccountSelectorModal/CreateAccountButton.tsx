import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Text,
} from '@onekeyhq/components';
import { isExternalWallet } from '@onekeyhq/engine/src/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from '../../WalletConnect/walletConnectConsts';
import { InitWalletServicesData } from '../../WalletConnect/WalletConnectQrcodeModal';
import { useCreateAccountInWallet } from '../hooks/useCreateAccountInWallet';

export function CreateAccountButton({
  fullBleed,
  walletId,
  networkId,
  isLoading,
}: {
  fullBleed: boolean;
  walletId: string;
  networkId: string | undefined;
  isLoading?: boolean;
}) {
  const intl = useIntl();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    networkId,
    walletId,
  });
  const isExternal = useMemo(() => {
    if (!walletId) {
      return false;
    }
    return isExternalWallet({ walletId });
  }, [walletId]);

  // const isDisabled = selectedNetworkId === AllNetwork
  // if (selectedNetworkId === AllNetwork) return null;

  const initWalletServiceRef = useRef<JSX.Element | undefined>();

  useEffect(() => {
    // iOS should open walletServices list Modal
    if (platformEnv.isNativeIOS) {
      return;
    }
    if (initWalletServiceRef.current) {
      return;
    }
    if (isExternal) {
      initWalletServiceRef.current = <InitWalletServicesData />;
    }
  }, [isExternal]);

  const [isCreatLoading, setIsCreatLoading] = useState(false);
  const timerRef = useRef<any>();

  const buttonIsLoading = isLoading || isCreatLoading;

  const buttonOnPress = useCallback(async () => {
    if (!walletId || isLoading) return;
    try {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => setIsCreatLoading(false),
        WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING,
      );
      setIsCreatLoading(true);

      await createAccount();
    } finally {
      clearTimeout(timerRef.current);
      setIsCreatLoading(false);
    }
  }, [createAccount, isLoading, walletId]);

  return (
    <>
      {/* TODO move to parent */}
      {initWalletServiceRef.current}

      {fullBleed ? (
        <Box p={2} pb={0}>
          <Button
            type="outline"
            isLoading={buttonIsLoading}
            onPress={buttonOnPress}
            rounded="xl"
            p={2}
            borderWidth={1}
            borderColor="border-default"
            borderStyle="dashed"
            _hover={{
              bgColor: 'surface-hovered',
              borderColor: 'border-default',
            }}
            _pressed={{
              bgColor: 'surface-pressed',
              borderColor: 'border-default',
            }}
            _focus={{
              bgColor: 'surface-pressed',
              borderColor: 'border-default',
            }}
          >
            <HStack alignItems="center">
              <Icon
                name={isCreateAccountSupported ? 'PlusSmSolid' : 'BanOutline'}
                size={20}
              />
              <Text ml={2} typography="Body2Strong">
                {intl.formatMessage({ id: 'action__add_account' })}
              </Text>
            </HStack>
          </Button>
        </Box>
      ) : (
        <IconButton
          isLoading={buttonIsLoading}
          onPress={buttonOnPress}
          type="plain"
          name="PlusCircleSolid"
          circle
        />
      )}
    </>
  );
}
