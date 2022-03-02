import React, { useCallback, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import { useNavigation, useRoute } from '@react-navigation/core';
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

import { IDappCallParams } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';

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

function useDappParams() {
  const route = useRoute();
  const params = route.params as IDappCallParams;
  let data: IJsonRpcRequest = {
    method: '',
    params: [],
  };
  try {
    data = JSON.parse(params.data);
  } catch (error) {
    console.error(`parse dapp params.data error: ${params.data}`);
  }
  return {
    ...params,
    data,
  };
}

/* Connection Modal are use to accept user with permission to dapp */
const Connection = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const navigation = useNavigation();
  const { account } = useActiveWalletAccount();
  const accountInfo = account as SimpleAccount;
  const { origin, data, scope, id } = useDappParams();
  const computedIsRug = isRug(MockData.target.link);

  const closeModal = useCallback(() => {
    // TODO also close window in extension, add add window unload event listener
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const rejectConnection = useCallback(() => {
    backgroundApiProxy.rejectPromiseCallback({
      id,
      error: web3Errors.provider.userRejectedRequest(),
    });
    closeModal();
  }, [closeModal, id]);

  const approveConnection = useCallback(() => {
    backgroundApiProxy.resolvePromiseCallback({
      id,
      // TODO data format may be different in different chain
      data: [accountInfo.address],
    });
    closeModal();
  }, [accountInfo.address, closeModal, id]);

  const [permissionValues, setPermissionValues] = React.useState(
    MockData.permissions.map(({ type }) => type),
  );

  // TODO
  //  - check scope=ethereum matches EVM only
  //  - check account exists

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
        onPrimaryActionPress={({ onClose }) => {
          if (!computedIsRug) {
            approveConnection();
            // Do approve operation
            // TODO onClose not working
            return onClose?.();
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={rejectConnection}
        // TODO right top corner onClose not working for calling rejectConnection
        onClose={rejectConnection}
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
