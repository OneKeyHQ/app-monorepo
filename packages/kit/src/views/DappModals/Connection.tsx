import React, { useCallback, useState } from 'react';

import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Center,
  HStack,
  Icon,
  Modal,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import Check from '@onekeyhq/kit/assets/connect_check.png';
import Sight from '@onekeyhq/kit/assets/connect_sight.png';
import X from '@onekeyhq/kit/assets/connect_x.png';
import Logo from '@onekeyhq/kit/assets/logo_round.png';

import { IDappSourceInfo } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import RugConfirmDialog from './RugConfirmDialog';

const MockData = {
  permissions: [
    {
      text: 'content__view_the_address_of_your_permitted_accounts_required',
      icon: Sight,
    },
    {
      text: 'content__send_transactions_and_signature_request',
      icon: Check,
    },
    {
      text: 'content__send_transactions_and_signature_request',
      icon: X,
    },
  ] as const,
};

const isRug = (target: string) => {
  const RUG_LIST: string[] = [];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

/* Connection Modal are use to accept user with permission to dapp */
const Connection = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const { networkImpl, network, accountAddress, account } =
    useActiveWalletAccount();
  const { sourceInfo } = useDappParams();
  const { origin, scope, id } = sourceInfo ?? ({} as IDappSourceInfo);
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
            <VStack flex="1" space={6}>
              <Center flex="1" mt="12px">
                <HStack>
                  <Image
                    size="64px"
                    borderRadius="full"
                    mr="-16px"
                    zIndex={100}
                    source={Logo}
                  />
                  <Image
                    size="64px"
                    source={{ uri: `${origin}/favicon.ico` }}
                    fallbackElement={<Token size="64px" />}
                  />
                </HStack>

                <Typography.PageHeading mt="24px">
                  {intl.formatMessage({
                    id: 'title__connect_to_website',
                  })}
                </Typography.PageHeading>

                <HStack justifyContent="center" alignItems="center" mt="16px">
                  <Typography.Body1 mr="18px">
                    {origin?.split('://')[1] ?? 'DApp'}
                  </Typography.Body1>
                  <Icon size={20} name="SwitchHorizontalSolid" />
                  <Image
                    src={network?.logoURI}
                    ml="18px"
                    mr="8px"
                    width="16px"
                    height="16px"
                    borderRadius="full"
                  />
                  <Typography.Body2>{account?.name}</Typography.Body2>
                </HStack>
              </Center>

              <VStack space={6} ml="12px" mt="24px">
                {MockData.permissions.map((permission) => (
                  <HStack>
                    <Image size="36px" source={permission.icon} />
                    <Typography.Body1 ml="16px" alignSelf="center">
                      {intl.formatMessage({
                        id: permission.text,
                      })}
                    </Typography.Body1>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          ),
        }}
      />
    </>
  );
};

export default Connection;
