import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  Icon,
  Modal,
  QRCode,
  Text,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import {
  ManagerAccountModalRoutes,
  ManagerAccountRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks/useToast';

type NavigationProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal
>;

const ExportPrivateViewModal = () => {
  const intl = useIntl();
  const toast = useToast();
  const borderColor = useThemeValue('border-subdued');
  const route = useRoute<NavigationProps>();
  const { engine } = backgroundApiProxy;

  const { accountId, networkId, password } = route.params;

  const [privateKey, setPrivateKey] = useState<string>();
  const [account, setAccount] = useState<AccountEngineType>();

  useEffect(() => {
    if (!accountId || !networkId) return;

    engine.getAccount(accountId, networkId).then(($account) => {
      setAccount($account);
    });

    engine.getAccountPrivateKey(accountId, password).then(($privateKey) => {
      setPrivateKey($privateKey);
    });
  }, [accountId, engine, networkId, password]);

  const copyDataToClipboard = useCallback(() => {
    copyToClipboard(privateKey ?? '');
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
  }, [toast, privateKey, intl]);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__export_private_key' })}
      headerDescription={account?.name}
      height="auto"
      scrollViewProps={{
        children: (
          <Column flex={1}>
            <Box alignItems="center">
              <Box
                padding="16px"
                borderWidth="1px"
                borderRadius="12px"
                bgColor="surface-default"
                borderColor={borderColor}
                width="192px"
              >
                {!!privateKey && <QRCode value={privateKey} size={160} />}
              </Box>
            </Box>
            <Row
              justifyContent="space-between"
              padding="16px"
              borderWidth="1px"
              borderRadius="12px"
              borderColor={borderColor}
              borderStyle="dashed"
              mt="24px"
            >
              <Text
                textAlign="center"
                typography="Body2"
                flex={1}
                noOfLines={3}
              >
                {privateKey}
              </Text>
            </Row>

            <TouchableOpacity onPress={copyDataToClipboard}>
              <Row
                mt="12px"
                space="12px"
                padding="10px"
                justifyContent="center"
              >
                <Icon name="DuplicateSolid" />
                <Typography.Button1 textAlign="center">
                  {intl.formatMessage({
                    id: 'action__copy_to_clipboard',
                  })}
                </Typography.Button1>
              </Row>
            </TouchableOpacity>
          </Column>
        ),
      }}
    />
  );
};

export default ExportPrivateViewModal;
