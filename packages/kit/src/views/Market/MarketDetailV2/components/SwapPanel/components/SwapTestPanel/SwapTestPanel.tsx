import { useMemo, useState } from 'react';

import { Button, Select, SizableText, Stack } from '@onekeyhq/components';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { useSpeedSwapInit } from '../../hooks/useSpeedSwapInit';

const testNetworks = getPresetNetworks()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((network) => ({
    label: network.name,
    value: network.id,
  }));

export function SwapTestPanel() {
  const [selectedTestNetworkId, setSelectedTestNetworkId] = useState<
    string | undefined
  >(() => testNetworks?.[0]?.value);

  // Only call useSpeedSwapInit if a network is selected
  const speedSwapProps = useSpeedSwapInit(
    selectedTestNetworkId ?? '', // Pass empty string if undefined, hook should handle it or be conditional
  );

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

  const selectedNetwork = useMemo(
    () => testNetworks.find((n) => n.value === selectedTestNetworkId),
    [selectedTestNetworkId],
  );

  if (testNetworks.length === 0) {
    return <SizableText>No test networks available.</SizableText>;
  }

  return (
    <Stack gap="$2">
      {selectedTestNetworkId ? (
        <Select
          title="Select Test Network"
          items={testNetworks}
          value={selectedTestNetworkId}
          onChange={setSelectedTestNetworkId}
          renderTrigger={() => (
            <Button>{selectedNetwork?.label ?? 'Select Test Network'}</Button>
          )}
        />
      ) : null}
      <Button
        onPress={handleTestHook}
        variant="primary"
        disabled={!selectedTestNetworkId}
      >
        Test useSpeedSwapInit
      </Button>
    </Stack>
  );
}
