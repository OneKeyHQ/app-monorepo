import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Searchbar,
  Typography,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';

import AccountList from './AccountList';
import AllNetworksAccountList from './AllNetworksAccountList';
import Header from './Header';
import { NetWorkExtraInfo } from './NetworkExtraInfo';
import SideChainSelector from './SideChainSelector';

import type { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';

function LazyDisplayContentView({
  showSideChainSelector,
  showCustomLegacyHeader,
  accountSelectorInfo,
}: {
  showSideChainSelector: boolean;
  showCustomLegacyHeader: boolean;
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const [search, setSearch] = useState('');

  return (
    <Box flex={1} flexDirection="row">
      {showSideChainSelector ? (
        <SideChainSelector
          accountSelectorInfo={accountSelectorInfo}
          allowSelectAllNetworks
        />
      ) : null}
      <Box alignSelf="stretch" flex={1}>
        <Header
          accountSelectorInfo={accountSelectorInfo}
          showCustomLegacyHeader={showCustomLegacyHeader}
        />
        <Box px={{ base: 4, md: 6 }} mb="16px">
          <Searchbar
            w="full"
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
          />
        </Box>
        <ScrollView>
          {isAllNetworks(accountSelectorInfo?.selectedNetworkId) ? (
            <AllNetworksAccountList
              accountSelectorInfo={accountSelectorInfo}
              searchValue={search}
            />
          ) : (
            <>
              <AccountList
                accountSelectorInfo={accountSelectorInfo}
                searchValue={search}
              />
              <NetWorkExtraInfo
                accountId={accountSelectorInfo.activeAccount?.id}
                networkId={accountSelectorInfo.selectedNetworkId}
              />
            </>
          )}
        </ScrollView>
      </Box>
    </Box>
  );
}
function NetworkAccountSelectorModal() {
  const intl = useIntl();

  const [showSideChainSelector, setShowSideChainSelector] = useState(false);
  // use Modal header or custom header
  const [showCustomLegacyHeader, setShowCustomLegacyHeader] = useState(false);

  const { accountSelectorInfo, shouldShowModal } =
    useAccountSelectorModalInfo();

  const networkName = useMemo(() => {
    if (isAllNetworks(accountSelectorInfo?.selectedNetworkId)) {
      return intl.formatMessage({ id: 'form__all_networks' });
    }
    return accountSelectorInfo?.selectedNetwork?.name || '-';
  }, [accountSelectorInfo, intl]);

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
            {networkName}
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
        <LazyDisplayContentView
          accountSelectorInfo={accountSelectorInfo}
          showSideChainSelector={showSideChainSelector}
          showCustomLegacyHeader={showCustomLegacyHeader}
        />
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkAccountSelectorModal };
