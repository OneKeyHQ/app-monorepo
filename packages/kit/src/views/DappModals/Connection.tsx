import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  HStack,
  Icon,
  Modal,
  Spinner,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { IAccount, INetwork } from '@onekeyhq/engine/src/types';
import Logo from '@onekeyhq/kit/assets/logo_round.png';
import {
  IMPL_COSMOS,
  isLightningNetworkByImpl,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import walletConnectUtils from '../../components/WalletConnect/utils/walletConnectUtils';
import { useActiveWalletAccount, useAppSelector } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useEffectOnUpdate } from '../../hooks/useEffectOnUpdate';
import { refreshConnectedSites } from '../../store/reducers/refresher';
import { DappSecurityView } from '../Send/components/DappSecurityView';

import RugConfirmDialog from './RugConfirmDialog';

import type { DappConnectionModalRoutes } from '../../routes/routesEnum';
import type { DappConnectionRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/core';

const MockData = {
  permissions: [
    {
      text: 'content__view_the_address_of_your_permitted_accounts_required',
      icon: 'EyeOutline',
    },
    {
      text: 'content__send_transactions_and_signature_request',
      icon: 'CheckOutline',
    },
    // {
    //   text: 'content__send_transactions_and_signature_request',
    //   icon: X,
    // },
  ] as const,
};

const isRug = (target: string) => {
  const RUG_LIST: string[] = [];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

type RouteProps = RouteProp<
  DappConnectionRoutesParams,
  DappConnectionModalRoutes.ConnectionModal
>;

// let lastWalletConnectUri: string | undefined = '';

function ConnectionContent({
  isWalletConnectPreloading,
  walletConnectError,
  getWalletConnectBridge,
  account,
  origin,
  hostname,
  network,
  walletId,
}: {
  account: IAccount | null | undefined;
  network: INetwork | null;
  walletId: string;
  isWalletConnectPreloading: boolean;
  walletConnectError: string;
  getWalletConnectBridge: () => string;
  origin: string;
  hostname: string;
}) {
  const intl = useIntl();
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    walletId,
    networkId: network?.id,
  });
  if (isWalletConnectPreloading) {
    return (
      <Center flex={1} minH="300px">
        {walletConnectError ? (
          // <Typography.DisplayXLarge my="16px">
          //   {walletConnectError}
          // </Typography.DisplayXLarge>
          <Empty
            emoji="😵"
            title={walletConnectError}
            subTitle={intl.formatMessage({
              id: 'empty__connection_failed_desc',
            })}
          />
        ) : (
          <>
            <Spinner size="lg" />
            {platformEnv.isDev ? (
              <Box mt={4}>
                <Text>{getWalletConnectBridge()}</Text>
              </Box>
            ) : null}
          </>
        )}
      </Center>
    );
  }

  if (!account?.id) {
    return (
      <Center flex={1} minH="300px">
        <Empty
          emoji="💳"
          title={intl.formatMessage({
            id: 'empty__no_account_title',
          })}
        />
        <Box
          position="relative"
          w={{ md: 'full' }}
          alignItems="center"
          h="56px"
          justifyContent="center"
        >
          <Button
            leftIconName={
              isCreateAccountSupported ? 'PlusOutline' : 'BanOutline'
            }
            type="primary"
            onPress={() => {
              if (isCreateAccountSupported) {
                // ** createAccount for current wallet directly
                createAccount();
              } else {
                ToastManager.show({
                  title: intl.formatMessage(
                    {
                      id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
                    },
                    { 0: network?.shortName },
                  ),
                });
              }
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_account' })}
          </Button>
        </Box>
      </Center>
    );
  }

  return (
    // Add padding to escape the footer
    <VStack
      flex="1"
      space="20px"
      bg="surface-default"
      p="4"
      borderRadius="12px"
    >
      <HStack alignItems="center">
        <HStack alignItems="center">
          <Box
            size="32px"
            borderWidth={2}
            borderColor="surface-subdued"
            mr="-8px"
            zIndex={1}
            rounded="full"
          >
            <Image
              w="full"
              h="full"
              borderRadius="full"
              zIndex={100}
              source={Logo}
            />
          </Box>
          <Box
            size="32px"
            overflow="hidden"
            rounded="full"
            borderWidth={2}
            zIndex={2}
            borderColor="surface-subdued"
            bg="surface-subdued"
          >
            <Image
              w="full"
              h="full"
              source={{ uri: `${origin}/favicon.ico` }}
              fallbackElement={
                <Center
                  width="full"
                  height="full"
                  borderRadius="full"
                  bg="background-selected"
                >
                  <Icon name="QuestionMarkOutline" />
                </Center>
              }
            />
          </Box>
        </HStack>
        <Typography.Body1Strong ml="2">
          {intl.formatMessage({
            id: 'title__connect_to_website',
          })}
        </Typography.Body1Strong>
      </HStack>
      <VStack pt="4" borderTopColor="divider" borderTopWidth="1px">
        {MockData.permissions.map((permission, index) => (
          <HStack key={index} mb="4">
            <Box
              borderRadius="full"
              bg="rgba(2, 190, 50, .1)"
              size="9"
              alignItems="center"
              justifyContent="center"
            >
              <Icon size={24} name={permission.icon} color="icon-success" />
            </Box>
            <Typography.Body1 ml="12px" alignSelf="center" flex={1}>
              {intl.formatMessage({
                id: permission.text,
              })}
            </Typography.Body1>
          </HStack>
        ))}
      </VStack>
      <VStack borderBottomWidth="1px" borderBottomColor="divider" pb="4">
        <HStack alignItems="center">
          <Typography.Body2Strong color="text-subdued" flex={1}>
            {intl.formatMessage({ id: 'form__account' })}
          </Typography.Body2Strong>
          <HStack alignItems="center">
            <Typography.Body2Strong ml="12px">
              {account?.name}
              {account?.address && account?.address.length
                ? `(${account.address.slice(-4)})`
                : ''}
            </Typography.Body2Strong>
          </HStack>
        </HStack>
      </VStack>
      <DappSecurityView
        origin={origin}
        hostname={hostname}
        networkId={network?.id ?? ''}
      />
    </VStack>
  );
}

/* Connection Modal are use to accept user with permission to dapp */
const defaultSourceInfo = Object.freeze({}) as IDappSourceInfo;
const Connection = () => {
  const { dispatch } = backgroundApiProxy;
  const closeDappConnectionPreloadingTs = useAppSelector(
    (s) => s.refresher.closeDappConnectionPreloadingTs,
  );
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();

  const {
    networkImpl,
    network,
    accountAddress,
    accountPubKey,
    account,
    walletId,
  } = useActiveWalletAccount();

  const { sourceInfo } = useDappParams();
  const { origin, scope, id } = sourceInfo ?? defaultSourceInfo;
  const computedIsRug = useMemo(() => isRug(origin), [origin]);
  const hostname = useMemo(() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin?.split('://')?.[1] || origin;
    }
  }, [origin]);
  const route = useRoute<RouteProps>();
  const walletConnectUri = route?.params?.walletConnectUri;
  const isDeepLink = route?.params?.isDeepLink;
  const refreshKey = route?.params?.refreshKey;

  // lastWalletConnectUri = walletConnectUri;
  const isWalletConnectPreloading = Boolean(walletConnectUri);
  const [walletConnectError, setWalletConnectError] = useState<string>('');
  const closeModal = useModalClose();

  const isClosedDone = useRef(false);
  useEffectOnUpdate(() => {
    if (isClosedDone.current) {
      return;
    }
    // **** close preloading Modal
    if (isWalletConnectPreloading) {
      if (closeDappConnectionPreloadingTs) {
        isClosedDone.current = true;
        closeModal();
      }
    }
  }, [
    closeDappConnectionPreloadingTs,
    closeModal,
    dispatch,
    isWalletConnectPreloading,
  ]);

  useEffect(
    () => () => {
      isClosedDone.current = true;
    },
    [],
  );
  const walletConnectUriInfo = useMemo(() => {
    if (!walletConnectUri) {
      return null;
    }
    return walletConnectUtils.getWalletConnectUriInfo({
      uri: walletConnectUri,
    });
  }, [walletConnectUri]);
  const getWalletConnectBridge = useCallback(
    () =>
      (walletConnectUriInfo?.v1 && walletConnectUriInfo?.v1?.bridge) ||
      (walletConnectUriInfo?.v2 &&
        `relay-protocol=${walletConnectUriInfo?.v2?.relayProtocol}`) ||
      '',
    [walletConnectUriInfo],
  );
  useEffect(() => {
    if (walletConnectUri) {
      if (refreshKey) {
        setWalletConnectError('');
      }
      backgroundApiProxy.walletConnect
        .connect({
          uri: walletConnectUri || '',
          isDeepLink,
        })
        .then(() => {
          //  Comment the following code to fix OK-15122 when networkNomatch then function will be called advance，When networkNomatch model first opened it
          //  look ServiceDapp 378-398 line code resolve() to be called manually for some special reason
          // if (!isClosedDone.current && lastWalletConnectUri) {
          //   closeModal();
          //   isClosedDone.current = true;
          // }
          dispatch(refreshConnectedSites());
        })
        .catch((error) => {
          debugLogger.common.error(error);
          setWalletConnectError(
            // TODO general connection failed error
            // timeout or qrcode expired
            intl.formatMessage({ id: 'modal__failed_to_connect' }),
          );
        });
    }
  }, [
    refreshKey,
    closeModal,
    dispatch,
    intl,
    isDeepLink,

    walletConnectUri,
    walletConnectUriInfo?.v2,
  ]);

  // TODO move to DappService
  const getResolveDataAsync = useCallback(async () => {
    // throw web3Errors.provider.unauthorized();
    // throw new Error('Testing: some error occur in approval.');
    if (
      (!networkImpl || !accountAddress) &&
      !isLightningNetworkByImpl(networkImpl)
    ) {
      throw new Error(
        'Wallet or account not selected, you should create or import one.',
      );
    }
    let address = accountAddress;
    if (scope === IMPL_COSMOS) {
      address = accountPubKey;
    }

    let accounts: string | string[] | { accounts: string[] } = [address].filter(
      Boolean,
    );
    // data format may be different in different chain
    if (scope === 'ethereum') {
      accounts = [address].filter(Boolean);
    }
    if (scope === 'near') {
      accounts = {
        accounts: [address].filter(Boolean),
      };
    }
    if (scope === 'solana') {
      accounts = address;
    }
    if (scope === 'webln') {
      const { hashAddress } = JSON.parse(account?.addresses ?? '');
      if (!hashAddress) {
        throw new Error('Wrong lightning account.');
      }
      address = hashAddress;
    }

    await backgroundApiProxy.serviceDapp.saveConnectedAccounts({
      site: {
        origin,
      },
      networkImpl,
      address,
    });
    return accounts;
  }, [accountAddress, accountPubKey, account, networkImpl, origin, scope]);

  const dappApprove = useDappApproveAction({
    id,
    closeOnError: true,
  });

  // TODO
  //  - check scope=ethereum and active chain is EVM
  //  - check active account exists
  //  - check network not exists

  return (
    <>
      {/* Rug warning Confirm Dialog */}
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => setRugConfirmDialogVisible(false)}
      />
      {/* Main Modal */}
      <Modal
        header={
          isWalletConnectPreloading
            ? intl.formatMessage({ id: 'content__connecting' })
            : intl.formatMessage({ id: 'title__dapp_connection' })
        }
        headerDescription={
          isWalletConnectPreloading ? 'WalletConnect' : network?.shortName ?? ''
        }
        primaryActionProps={{
          isDisabled: !origin,
        }}
        hidePrimaryAction={isWalletConnectPreloading || !account?.id}
        hideSecondaryAction
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__cancel"
        onPrimaryActionPress={async ({ close }) => {
          try {
            if (!computedIsRug) {
              const result = await getResolveDataAsync();
              return await dappApprove.resolve({ close, result });
            }
            // Do confirm before approve
            setRugConfirmDialogVisible(true);
          } catch (error) {
            const e = error as Error | undefined;
            console.error(error);
            ToastManager.show(
              { title: e?.message || 'Confirm Connection failed.' },
              { type: 'error' },
            );
          }
        }}
        onSecondaryActionPress={({ close }) => {
          dappApprove.reject();
          close();
        }}
        // TODO onClose may trigger many times
        onModalClose={dappApprove.reject}
        scrollViewProps={{
          contentContainerStyle: { flex: 1 },
          children: (
            <ConnectionContent
              walletConnectError={walletConnectError}
              isWalletConnectPreloading={isWalletConnectPreloading}
              getWalletConnectBridge={getWalletConnectBridge}
              network={network}
              account={account}
              walletId={walletId}
              hostname={hostname}
              origin={origin}
            />
          ),
        }}
      />
    </>
  );
};

export default Connection;
