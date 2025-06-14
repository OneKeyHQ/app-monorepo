import { useState } from 'react';

import {
  Button,
  ScrollView,
  Select,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import type { useSwapPanel } from '../../hooks/useSwapPanel';

const testNetworks = getPresetNetworks()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((network) => ({
    label: network.name,
    value: network.id,
  }));

export function SwapTestPanel({
  swapPanel,
  useSpeedSwapActionsParams,
  speedSwapActions,
}: {
  swapPanel: ReturnType<typeof useSwapPanel>;
  useSpeedSwapActionsParams?: any;
  speedSwapActions?: {
    speedSwapBuildTx: () => Promise<any>;
    speedSwapBuildTxLoading: boolean;
    checkTokenAllowanceLoading: boolean;
    speedSwapApproveHandler: () => Promise<void>;
    speedSwapApproveLoading: boolean;
    shouldApprove: boolean;
    balance: any;
    balanceToken: any;
  };
}) {
  const [showParams, setShowParams] = useState(false);

  const {
    networkId: selectedTestNetworkId,
    setNetworkId: setSelectedTestNetworkId,
  } = swapPanel;

  const handleTestHook = () => {
    if (!selectedTestNetworkId) {
      console.log('No test network selected.');
    }
  };

  const handleTestApproveAllowance = () => {
    console.log('checkTokenApproveAllowance test button clicked');
    // This is a placeholder for the test functionality
    // In a real implementation, you would need access to the actual function
  };

  const handleShowSpeedSwapActionsParams = () => {
    setShowParams(!showParams);
  };

  if (testNetworks.length === 0) {
    return <SizableText>No test networks available.</SizableText>;
  }

  return (
    <Stack
      gap="$1"
      position="absolute"
      $platform-web={{
        position: 'fixed',
      }}
      bottom={70}
      left={220}
      backgroundColor="$bgApp"
      padding="$3"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      zIndex={1000}
      maxWidth={600}
    >
      {selectedTestNetworkId ? (
        <Select
          title="Select Test Network"
          items={testNetworks}
          value={selectedTestNetworkId}
          onChange={setSelectedTestNetworkId}
        />
      ) : null}
      <Button
        size="small"
        onPress={handleTestHook}
        variant="primary"
        disabled={!selectedTestNetworkId}
      >
        Test useSpeedSwapInit
      </Button>
      <Button
        size="small"
        variant="primary"
        onPress={() => console.log(swapPanel)}
      >
        Print swapPanel
      </Button>
      <Button
        size="small"
        variant="secondary"
        onPress={handleTestApproveAllowance}
      >
        checkTokenApproveAllowance
      </Button>
      <Button
        size="small"
        variant="secondary"
        onPress={handleShowSpeedSwapActionsParams}
        disabled={!useSpeedSwapActionsParams}
      >
        {showParams ? 'Hide' : 'Show'} useSpeedSwapActionsParams JSON
      </Button>
      <Button
        size="small"
        variant="secondary"
        onPress={() => {
          if (speedSwapActions?.speedSwapBuildTx) {
            console.log('Testing speedSwapBuildTx...');
            void speedSwapActions.speedSwapBuildTx();
          } else {
            console.log('speedSwapBuildTx not available in speedSwapActions');
          }
        }}
        disabled={!speedSwapActions?.speedSwapBuildTx}
      >
        Test speedSwapBuildTx
      </Button>

      {showParams && useSpeedSwapActionsParams ? (
        <ScrollView
          backgroundColor="$bg"
          padding="$2"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
          maxHeight={300}
          showsVerticalScrollIndicator
        >
          <SizableText size="$bodySm" color="$textSubdued" selectable>
            {JSON.stringify(useSpeedSwapActionsParams, null, 2)}
          </SizableText>
        </ScrollView>
      ) : null}
    </Stack>
  );
}
