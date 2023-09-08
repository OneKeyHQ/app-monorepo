import { useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Searchbar,
  Typography,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';

import AccountList from './AccountList';
import AllNetworksAccountList from './AllNetworksAccountList';
import Header from './Header';
import { NetWorkExtraInfo } from './NetworkExtraInfo';
import SideChainSelector from './SideChainSelector';

import type { ManageNetworkRoutesParams } from '../../../../routes';
import type { ManageNetworkModalRoutes } from '../../../../routes/routesEnum';
import type { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkAccountSelector
>;

type LazyDisplayContentViewProps = {
  showSideChainSelector: boolean;
  showCustomLegacyHeader: boolean;
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  selectedAccounts: string[];
  setSelectedAccounts: React.Dispatch<React.SetStateAction<string[]>>;
} & ManageNetworkRoutesParams['NetworkAccountSelector'];

function LazyDisplayContentView(props: LazyDisplayContentViewProps) {
  const {
    accountSelectorInfo,
    showCustomLegacyHeader,
    showSideChainSelector,
    hideAllNetworks,
    hideSearchBar,
    hideCreateAccount,
    hideAccountActions,
    multiSelect,
    singleSelect,
    selectedAccounts,
    setSelectedAccounts,
    onAccountsSelected,
    tokenShowBalance,
    walletsToHide,
  } = props;
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
          hideCreateAccount={hideCreateAccount}
          multiSelect={multiSelect}
          selectedAccounts={selectedAccounts}
          walletsToHide={walletsToHide}
        />
        {!hideSearchBar ? (
          <Box px={{ base: 4, md: 6 }} mb="16px">
            <Searchbar
              w="full"
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
            />
          </Box>
        ) : null}
        <ScrollView>
          {!hideAllNetworks &&
          isAllNetworks(accountSelectorInfo?.selectedNetworkId) ? (
            <AllNetworksAccountList
              accountSelectorInfo={accountSelectorInfo}
              searchValue={search}
            />
          ) : (
            <>
              <AccountList
                accountSelectorInfo={accountSelectorInfo}
                searchValue={search}
                multiSelect={multiSelect}
                singleSelect={singleSelect}
                tokenShowBalance={tokenShowBalance}
                hideAccountActions={hideAccountActions}
                selectedAccounts={selectedAccounts}
                setSelectedAccounts={setSelectedAccounts}
                onAccountsSelected={onAccountsSelected}
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
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const closeModal = useModalClose();

  const { hideSideChain, multiSelect, onAccountsSelected } = route.params ?? {};

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
          isDisabled={!hideSideChain}
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
      footer={
        multiSelect ? (
          <Box padding={4}>
            <Button
              type="primary"
              size="xl"
              isDisabled={selectedAccounts.length === 0}
              onPress={() => {
                closeModal();
                onAccountsSelected?.(selectedAccounts);
              }}
            >
              {intl.formatMessage({ id: 'action__add' })}
            </Button>
          </Box>
        ) : null
      }
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
          selectedAccounts={selectedAccounts}
          setSelectedAccounts={setSelectedAccounts}
          {...route.params}
        />
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkAccountSelectorModal };
