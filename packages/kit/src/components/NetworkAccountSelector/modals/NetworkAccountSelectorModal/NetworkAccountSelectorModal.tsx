/* eslint-disable @typescript-eslint/ban-types */
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';

import AccountList from './AccountList';
import Header from './Header';
import { NetWorkExtraInfo } from './NetworkExtraInfo';
import SideChainSelector from './SideChainSelector';

function NetworkAccountSelectorModal() {
  const intl = useIntl();

  const [showSideChainSelector, setShowSideChainSelector] = useState(false);
  // use Modal header or custom header
  const [showCustomLegacyHeader, setShowCustomLegacyHeader] = useState(false);

  const { accountSelectorInfo, shouldShowModal } =
    useAccountSelectorModalInfo();

  if (!shouldShowModal) {
    return null;
  }

  return (
    <Modal
      headerShown={!showCustomLegacyHeader}
      header={intl.formatMessage({ id: 'title__accounts' })}
      headerDescription={
        <Pressable
          onLongPress={() => {
            setShowCustomLegacyHeader(!showCustomLegacyHeader);
          }}
          onPress={() => {
            setShowSideChainSelector(!showSideChainSelector);
          }}
          flexDirection="row"
          alignItems="center"
          hitSlop={8}
        >
          {accountSelectorInfo?.selectedNetwork?.logoURI ? (
            <Image
              source={{ uri: accountSelectorInfo?.selectedNetwork?.logoURI }}
              size={4}
              borderRadius="full"
              mr={2}
            />
          ) : null}
          <Typography.Caption color="text-subdued">
            {accountSelectorInfo?.selectedNetwork?.name || '-'}
          </Typography.Caption>
        </Pressable>
      }
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
    >
      <LazyDisplayView delay={0}>
        <Box flex={1} flexDirection="row">
          {showSideChainSelector ? (
            <SideChainSelector accountSelectorInfo={accountSelectorInfo} />
          ) : null}
          <Box alignSelf="stretch" flex={1}>
            <Header
              accountSelectorInfo={accountSelectorInfo}
              showCustomLegacyHeader={showCustomLegacyHeader}
            />
            <ScrollView>
              <AccountList accountSelectorInfo={accountSelectorInfo} />
              <NetWorkExtraInfo
                accountId={accountSelectorInfo.activeAccount?.id}
                networkId={accountSelectorInfo.selectedNetworkId}
              />
            </ScrollView>
          </Box>
        </Box>
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkAccountSelectorModal };
