import React, { useCallback, useState } from 'react';

import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  CheckBox,
  Modal,
  Token,
  Typography,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { Text } from '@onekeyhq/components/src/Typography';
import { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';

import { IDappCallParams } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import { DescriptionList, DescriptionListItem } from './DescriptionList';
import RugConfirmDialog from './RugConfirmDialog';

type PermissionType = 'view-addresses';
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
  ] as Permission[],
};

const getPermissionTransId = (type: PermissionType): LocaleIds => {
  switch (type) {
    case 'view-addresses':
      return 'content__view_the_address_of_your_permitted_accounts_required';
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
  const { account, networkImpl, accountAddress } = useActiveWalletAccount();
  const accountInfo = account as DBSimpleAccount | null;
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
    getResolveData,
    closeOnError: true,
  });

  const [permissionValues, setPermissionValues] = React.useState(
    MockData.permissions.map(({ type }) => type),
  );

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
        onPrimaryActionPress={({ close }) => {
          if (!computedIsRug) {
            return dappApprove.resolve({ close });
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={dappApprove.reject}
        // TODO onClose may trigger many times
        onClose={dappApprove.reject}
        scrollViewProps={{
          children: (
            // Add padding to escape the footer
            <Column flex="1" pb="20" space={6}>
              <Center>
                <Token size="56px" />
                <Typography.Heading mt="8px">{origin}</Typography.Heading>
              </Center>
              <DescriptionList>
                {/* Account */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'form__account',
                  })}
                  detail={
                    <Column alignItems="flex-end" w="auto" flex={1}>
                      <Text
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      >
                        {accountInfo?.name}
                      </Text>
                      <Typography.Body2
                        textAlign="right"
                        color="text-subdued"
                        numberOfLines={3}
                      >
                        {accountInfo?.address}
                      </Typography.Body2>
                    </Column>
                  }
                />
                {/* Interact target */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__interact_with',
                  })}
                  detail={origin}
                  isRug={computedIsRug}
                />
              </DescriptionList>

              {/* Permissions */}
              <Column space={2}>
                <Box>
                  <Typography.Subheading mt="24px" color="text-subdued">
                    {intl.formatMessage({
                      id: 'form__allow_this_site_to_uppercase',
                    })}
                  </Typography.Subheading>
                </Box>
                <CheckBox.Group
                  onChange={setPermissionValues}
                  value={permissionValues}
                  accessibilityLabel="choose numbers"
                >
                  {MockData.permissions.map((permission, index) => (
                    <CheckBox
                      key={index}
                      value={permission.type}
                      isChecked={permission.required}
                      isDisabled={permission.required}
                      defaultIsChecked={permission.required}
                      my={2}
                      title={intl.formatMessage({
                        id: getPermissionTransId(permission.type),
                      })}
                    />
                  ))}
                </CheckBox.Group>
              </Column>
            </Column>
          ),
        }}
      />
    </>
  );
};

export default Connection;
