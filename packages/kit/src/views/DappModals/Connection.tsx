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
import { Text } from '@onekeyhq/components/src/Typography';
import { SimpleAccount } from '@onekeyhq/engine/src/types/account';

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
  account: {
    address: '0x4d16878c270x4d16878c270x4',
    name: 'ETH #1',
  },
  // target: {
  //   avatar:
  //     'https://raw.githubusercontent.com/Uniswap/interface/main/public/images/512x512_App_Icon.png',
  //   name: 'Uniswap',
  //   link: 'app.uniswap.org',
  // },
  target: {
    avatar:
      'https://raw.githubusercontent.com/pancakeswap/pancake-frontend/develop/public/logo.png',
    name: 'Pancakeswap',
    link: 'pancakeswap.finance',
  },
  permissions: [
    {
      type: 'view-addresses',
      required: true,
    },
    {
      type: 'A fake permission',
      required: false,
    },
  ] as Permission[],
};

const getPermissionTransId = (type: PermissionType) => {
  switch (type) {
    case 'view-addresses':
      return 'content__view_the_address_of_your_permitted_accounts_required';
    default:
      return type;
  }
};
const isRug = (target: string) => {
  const RUG_LIST = ['app.uniswap.org'];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

/* Connection Modal are use to accept user with permission to dapp */
const Connection = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const { account } = useActiveWalletAccount();
  const accountInfo = account as SimpleAccount;
  const computedIsRug = isRug(MockData.target.link);
  const { origin, data, scope, id } = useDappParams();

  const getResolveData = useCallback(() => {
    let accounts: string | string[] | { accounts: string[] } = [
      accountInfo.address,
    ];
    // data format may be different in different chain
    if (scope === 'ethereum') {
      accounts = [accountInfo.address];
    }
    if (scope === 'near') {
      accounts = {
        accounts: [accountInfo.address],
      };
    }
    if (scope === 'solana') {
      accounts = accountInfo.address;
    }
    return accounts;
  }, [accountInfo.address, scope]);

  const dappApprove = useDappApproveAction({
    id,
    getResolveData,
  });

  const [permissionValues, setPermissionValues] = React.useState(
    MockData.permissions.map(({ type }) => type),
  );

  // TODO
  //  - check scope=ethereum and active chain is EVM
  //  - check active account exists

  return (
    <>
      {/* Rug warning Confirm Dialog */}
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => {
          // Do something
        }}
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
        onClose={() => dappApprove.reject({ close: () => null })}
        scrollViewProps={{
          children: (
            // Add padding to escape the footer
            <Column flex="1" pb="20" space={6}>
              <Center>
                <Token src={MockData.target.avatar} size="56px" />
                <Typography.Heading mt="8px">
                  {data?.method}:{id}
                </Typography.Heading>
              </Center>
              <DescriptionList>
                {/* Account */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__account_lowercase',
                  })}
                  detail={
                    <Column alignItems="flex-end" w="auto" flex={1}>
                      <Text
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      >
                        {accountInfo.name}
                      </Text>
                      <Typography.Body2 textAlign="right" color="text-subdued">
                        {accountInfo.address}
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
                  {MockData.permissions.map((permission) => (
                    <CheckBox
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
