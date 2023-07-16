import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, HStack, Modal, Spinner, Switch } from '@onekeyhq/components';
import type { IGasInfo } from '@onekeyhq/engine/src/types/gas';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNativeToken, useSettings } from '../../hooks';
import { appSelector } from '../../store';
import { setGasPanelEIP1559Enabled } from '../../store/reducers/settings';

import { supportedNetworks, supportedNetworksSettings } from './config';
import { GasList } from './GasList';
import { GasOverview } from './GasOverview';
import { GasRefreshTip } from './GasRefreshTip';
import { NetworkSelector } from './NetworkSelector';

import type { GasPanelRoutes, GasPanelRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<GasPanelRoutesParams, GasPanelRoutes.GasPanelModal>;

const DEFAULT_NETWORK = OnekeyNetwork.eth;
const REFRESH_GAS_INFO_INTERVAL = 6000;
let timer: NodeJS.Timeout | null = null;

function GasPanel() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();

  const { networkId = '' } = route.params;

  const { selectedFiatMoneySymbol } = appSelector((s) => s.settings);

  const [selectedNetworkId, setSelectedNetworkId] = useState(
    supportedNetworks.includes(networkId) ? networkId : DEFAULT_NETWORK,
  );
  const [isGasInfoInit, setIsGasInfoInit] = useState(false);
  const [gasInfo, setGasInfo] = useState<IGasInfo | null>(null);
  const [leftSeconds, setLeftSeconds] = useState(
    REFRESH_GAS_INFO_INTERVAL / 1000,
  );
  const settings = useSettings();

  const token = useNativeToken(selectedNetworkId);

  const { serviceGas } = backgroundApiProxy;

  const isEIP1559 = useMemo(() => {
    if (gasInfo && gasInfo.prices[0]) {
      return (
        typeof gasInfo.prices[0] === 'object' &&
        'maxFeePerGas' in gasInfo.prices[0] &&
        'maxPriorityFeePerGas' in gasInfo.prices[0]
      );
    }
    return false;
  }, [gasInfo]);

  const isEIP1559Enabled = settings?.gasPanelEIP1559Enabled ?? true;

  const setIsEIP1559Enabled = useCallback((isEnabled) => {
    backgroundApiProxy.dispatch(setGasPanelEIP1559Enabled(isEnabled));
  }, []);

  useEffect(() => {
    setGasInfo(null);
    if (timer) {
      clearTimeout(timer);
    }
    const fetchGasInfo = async () => {
      const resp = await serviceGas.getGasInfo({
        networkId: selectedNetworkId,
      });

      if (resp.prices.length === 5) {
        resp.prices = [resp.prices[0], resp.prices[2], resp.prices[4]];
      }

      setGasInfo(resp);
      setIsGasInfoInit(true);
      timer = setTimeout(() => fetchGasInfo(), REFRESH_GAS_INFO_INTERVAL);
      setLeftSeconds(REFRESH_GAS_INFO_INTERVAL / 1000);
    };
    fetchGasInfo();
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [selectedNetworkId, serviceGas]);

  useEffect(() => {
    if (networkId && supportedNetworks.includes(networkId)) {
      setSelectedNetworkId(networkId);
    }
  }, [networkId]);

  useEffect(() => {
    backgroundApiProxy.servicePrice.fetchSimpleTokenPrice({
      networkId: selectedNetworkId,
      tokenIds: [token?.tokenIdOnNetwork ?? ''],
      vsCurrency: selectedFiatMoneySymbol,
    });
  }, [
    networkId,
    selectedFiatMoneySymbol,
    selectedNetworkId,
    token?.tokenIdOnNetwork,
  ]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'content__gas_fee' })}
      height="560px"
      hideSecondaryAction
      onPrimaryActionPress={({ close }) => close()}
      primaryActionProps={{
        type: 'primary',
      }}
      primaryActionTranslationId="action__i_got_it"
      scrollViewProps={{
        children: isGasInfoInit ? (
          <>
            <HStack justifyContent="space-between" alignItems="center">
              <NetworkSelector
                selectedNetworkId={selectedNetworkId}
                setSelectedNetworkId={setSelectedNetworkId}
              />

              {isEIP1559 &&
              supportedNetworksSettings[selectedNetworkId].EIP1559Enabled ? (
                <Switch
                  onToggle={() => {
                    setIsEIP1559Enabled(!isEIP1559Enabled);
                  }}
                  isChecked={isEIP1559Enabled}
                  label="EIP 1559"
                  size="mini"
                />
              ) : null}
            </HStack>
            {supportedNetworksSettings[selectedNetworkId].supportOverview ? (
              <GasOverview
                mt={8}
                gasInfo={gasInfo}
                isEIP1559Enabled={isEIP1559Enabled}
                selectedNetworkId={selectedNetworkId}
              />
            ) : null}
            <GasList
              mt={6}
              gasInfo={gasInfo}
              isEIP1559Enabled={isEIP1559Enabled}
              selectedNetworkId={selectedNetworkId}
            />
            {gasInfo ? (
              <GasRefreshTip
                mt={12}
                leftSeconds={leftSeconds}
                setLeftSeconds={setLeftSeconds}
              />
            ) : null}
          </>
        ) : (
          <Center w="full" py={10}>
            <Spinner size="lg" />
          </Center>
        ),
      }}
    />
  );
}

export { GasPanel };
