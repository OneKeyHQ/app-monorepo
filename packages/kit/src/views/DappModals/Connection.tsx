import React, { useCallback, useState } from 'react';

import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Modal,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import Dots from '@onekeyhq/kit/assets/3_dots.png';
import AccountIcon from '@onekeyhq/kit/assets/account_icon.png';
import Logo from '@onekeyhq/kit/assets/logo_round.png';
import ChainNetworkIcon from '@onekeyhq/kit/assets/network_icon.png';

import { IDappCallParams } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import RugConfirmDialog from './RugConfirmDialog';

type PermissionType = 'view-addresses' | 'sign-and-send-transactions';
type Permission = {
  type: PermissionType;
  required: boolean;
};

const MockData = {
  permissions: [
    {
      type: 'view-addresses',
      required: true,
    },
    {
      type: 'sign-and-send-transactions',
      required: true,
    },
  ] as Permission[],
};

const getPermissionTransId = (type: PermissionType): LocaleIds => {
  switch (type) {
    case 'view-addresses':
      return 'content__view_the_address_of_your_permitted_accounts_required';
    case 'sign-and-send-transactions':
      return 'content__send_transactions_and_signature_request';
    default:
      return type;
  }
};
const isRug = (target: string) => {
  const RUG_LIST: string[] = [];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

/* Connection Modal are use to accept user with permission to dapp */
const Connection = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const { networkImpl, network, accountAddress } = useActiveWalletAccount();
  const { sourceInfo } = useDappParams();
  const { origin, scope, id } = sourceInfo ?? ({} as IDappCallParams);
  const computedIsRug = isRug(origin);

  // TODO move to DappService
  const getResolveData = useCallback(() => {
    // throw web3Errors.provider.unauthorized();
    // throw new Error('Testing: some error occur in approval.');
    if (!networkImpl || !accountAddress) {
      throw new Error(
        'Wallet or account not selected, you should create or import one.',
      );
    }
    const address = accountAddress;
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
    backgroundApiProxy.serviceDapp.saveConnectedAccounts({
      site: {
        origin,
      },
      networkImpl,
      address,
    });
    return accounts;
  }, [accountAddress, networkImpl, origin, scope]);

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
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__reject"
        header={intl.formatMessage({ id: 'title__approve' })}
        headerDescription={scope}
        onPrimaryActionPress={async ({ close }) => {
          if (!computedIsRug) {
            const result = getResolveData();
            return dappApprove.resolve({ close, result });
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={({ close }) => {
          dappApprove.reject();
          close();
        }}
        // TODO onClose may trigger many times
        onModalClose={dappApprove.reject}
        scrollViewProps={{
          children: (
            // Add padding to escape the footer
            <VStack flex="1" pb="20" space={6}>
              <Center flex="1">
                <HStack>
                  <Image
                    size="56px"
                    borderRadius="full"
                    source={{ uri: `${origin}/favicon.ico` }}
                    fallbackElement={<Token size="56px" />}
                  />
                  <Image
                    w="28px"
                    h="56px"
                    source={Dots}
                    resizeMode="center"
                    marginLeft="16px"
                    marginRight="16px"
                  />
                  <Image size="56px" source={Logo} />
                </HStack>
                <Typography.PageHeading mt="8px">
                  {intl.formatMessage({
                    id: 'title__connect_to_website',
                  })}
                </Typography.PageHeading>
              </Center>
              <VStack space={2}>
                <Box>
                  <Typography.Subheading mt="24px" color="text-subdued">
                    {intl.formatMessage({
                      id: 'form__allow_this_site_to_uppercase',
                    })}
                  </Typography.Subheading>
                </Box>

                {MockData.permissions.map((permission) => (
                  <HStack alignItems="center">
                    <Icon size={20} name="CheckSolid" />
                    <Typography.Body1 ml="7px">
                      {intl.formatMessage({
                        id: getPermissionTransId(permission.type),
                      })}
                    </Typography.Body1>
                  </HStack>
                ))}
              </VStack>

              {/* Account */}
              <VStack space={2}>
                <Box
                  // h="52px"
                  borderWidth="1px"
                  borderColor="border-disabled"
                  borderRadius="12px"
                >
                  <HStack flex="1" pt="4px" pb="4px">
                    <HStack flex="1">
                      <Image
                        mt="6px"
                        mr="8px"
                        ml="8px"
                        size="16px"
                        source={AccountIcon}
                      />
                      <VStack mt="6px" mb="6px">
                        <Typography.Subheading color="text-disabled">
                          ACCOUNT
                        </Typography.Subheading>
                        <Typography.Body2>ACCOUNT#1</Typography.Body2>
                      </VStack>
                    </HStack>
                    <HStack
                      flex="1"
                      borderLeftWidth={1}
                      borderColor="border-disabled"
                    >
                      <Image
                        mt="6px"
                        mr="8px"
                        ml="8px"
                        size="16px"
                        source={ChainNetworkIcon}
                      />
                      <VStack mt="6px" mb="6px">
                        <Typography.Subheading color="text-disabled">
                          NETWORK
                        </Typography.Subheading>
                        <Typography.Body2>{network?.name}</Typography.Body2>
                      </VStack>
                    </HStack>
                  </HStack>
                </Box>
                <Center>
                  <Typography.Body2 color="text-disabled">
                    Approving will redirect to:
                  </Typography.Body2>
                  <Typography.Body2>{origin}</Typography.Body2>
                </Center>
              </VStack>
            </VStack>
          ),
        }}
      />
    </>
  );
};

export default Connection;
