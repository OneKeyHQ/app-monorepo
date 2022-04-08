import React from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Modal,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { useToast } from '../../hooks/useToast';
import { DappApproveModalRoutes, DappApproveRoutesParams } from '../../routes';

const MOCKED_COUNTRACT_DATA = `Parameters:
[
  {
    "type": "address"
  },
  {
    "type": "address"
  },
  {
    "type": "uint256"
  },
  {
    "type": "uint256"
  },
  {
    "type": "uint32"
  },
  {
    "type": "bytes"
  },
  {
    "type": "[]"
  }
]`;

type RouteProps = RouteProp<
  DappApproveRoutesParams,
  DappApproveModalRoutes.ContractDataModal
>;

const ContractData = () => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const toast = useToast();

  const route = useRoute<RouteProps>();
  const { contractData } = route.params || {
    contractData: MOCKED_COUNTRACT_DATA,
  };
  const navigator = useNavigation();

  const copyContractData = () => {
    copyToClipboard(contractData);
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
  };

  const footer = (
    <Column>
      <Divider />
      <Row
        justifyContent="flex-end"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        pt={4}
        pb={4}
      >
        <Button
          flexGrow={isSmallScreen ? 1 : 0}
          type="primary"
          size={isSmallScreen ? 'lg' : 'base'}
          isDisabled={false}
          onPress={copyContractData}
        >
          {intl.formatMessage({ id: 'action__copy' })}
        </Button>
      </Row>
    </Column>
  );

  return (
    <Modal
      primaryActionTranslationId="action__copy"
      header={intl.formatMessage({ id: 'form__contract_data' })}
      footer={footer}
      onSecondaryActionPress={() => {
        if (navigator.canGoBack()) {
          navigator.goBack();
        }
      }}
      scrollViewProps={{
        children: (
          <Typography.Body2 numberOfLines={2 ** 256} color="text-subdued">
            {contractData}
          </Typography.Body2>
        ),
      }}
    />
  );
};

export default ContractData;
