import { Button, Select, SizableText, Stack } from '@onekeyhq/components';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { useSpeedSwapInit } from '../../hooks/useSpeedSwapInit';

import type { useSwapPanel } from '../../hooks/useSwapPanel';

const testNetworks = getPresetNetworks()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((network) => ({
    label: network.name,
    value: network.id,
  }));

export function SwapTestPanel({
  swapPanel,
}: {
  swapPanel: ReturnType<typeof useSwapPanel>;
}) {
  const {
    networkId: selectedTestNetworkId,
    setNetworkId: setSelectedTestNetworkId,
  } = swapPanel;

  const speedSwapProps = useSpeedSwapInit(selectedTestNetworkId ?? '');

  const handleTestHook = () => {
    if (!selectedTestNetworkId) {
      console.log('No test network selected.');
      return;
    }
    console.log(
      'useSpeedSwapInit props for network',
      selectedTestNetworkId,
      speedSwapProps,
    );
  };

  if (testNetworks.length === 0) {
    return <SizableText>No test networks available.</SizableText>;
  }

  return (
    <Stack gap="$1">
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
    </Stack>
  );
}
