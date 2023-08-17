import { useEffect, useState } from 'react';

import { onUpdate, start } from 'react-native-metrix';

import { Box, ScrollView, Text } from '@onekeyhq/components';

import type { metrixUpdateInfo } from 'react-native-metrix/src/NativeMetrix';

export const MonitorSettings = () => {
  const [info, setInfo] = useState<metrixUpdateInfo>();
  useEffect(() => {
    start();
    onUpdate(setInfo);
  }, []);
  return (
    <ScrollView p={4} flex="1" bg="background-hovered">
      <Box py={4} />
      <Text>jsFps: {info?.jsFps}</Text>
      <Text>uiFps: {info?.uiFps}</Text>
      <Text>usedCpu: {info?.usedCpu.toFixed(2)}%</Text>
      <Text>
        usedRam: {`${((info?.usedRam || 0) / 1024 / 1024).toFixed(2)} Mb`}
      </Text>
    </ScrollView>
  );
};
