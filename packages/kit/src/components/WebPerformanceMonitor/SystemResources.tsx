import { useEffect, useState } from 'react';

import { StyleSheet, TextInput, View } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  text: {
    userSelect: 'none',
    cursor: 'pointer',
    width: 120,
    fontSize: 13,
    color: '#000',
    paddingHorizontal: 3,
  },
  highUsage: {
    color: 'red',
    fontWeight: '800',
  },
});

type ISystemResourcesData = {
  cpu: number;
  memory: {
    private: number;
    residentSet: number | undefined;
    blink: {
      allocated: string;
      total: string;
    };
  };
};

const REFRESH_INTERVAL = 1000; // 1 second
const HIGH_CPU_THRESHOLD = 80; // 80%
const HIGH_MEMORY_THRESHOLD = 512; // 512 MB

function SystemResources() {
  const [resources, setResources] = useState<ISystemResourcesData>({
    cpu: 0,
    memory: {
      private: 0,
      residentSet: undefined,
      blink: {
        allocated: '0',
        total: '0',
      },
    },
  });

  useEffect(() => {
    if (!platformEnv.isDesktop) {
      return;
    }

    let isActive = true;

    const updateResources = async () => {
      try {
        const [cpuData, memoryData] = await Promise.all([
          globalThis.desktopApi?.getCpuUsage(),
          globalThis.desktopApi?.getMemoryUsage(),
        ]);

        if (isActive && cpuData && memoryData) {
          setResources({
            cpu: Math.round(cpuData.usage),
            memory: memoryData,
          });
        }
      } catch (error) {
        console.error('Failed to get system resources:', error);
      }
    };

    // Initial update
    void updateResources();

    // Update every second
    const interval = setInterval(() => {
      void updateResources();
    }, REFRESH_INTERVAL);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  if (!platformEnv.isDesktop) {
    return null;
  }

  const isCpuHigh = resources.cpu > HIGH_CPU_THRESHOLD;
  const isPrivateHigh = resources.memory.private > HIGH_MEMORY_THRESHOLD;
  const isResidentSetHigh = resources.memory.residentSet
    ? resources.memory.residentSet > HIGH_MEMORY_THRESHOLD
    : false;
  const isBlinkHigh =
    parseFloat(resources.memory.blink.allocated) > HIGH_MEMORY_THRESHOLD;

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.text, isCpuHigh && styles.highUsage]}
        value={`CPU: ${resources.cpu}%`}
        editable={false}
        accessible
      />
      <TextInput
        style={[styles.text, isPrivateHigh && styles.highUsage]}
        value={`MEM: ${Number(resources.memory.private)}MB`}
        editable={false}
        accessible
      />
      {resources.memory.residentSet !== undefined ? (
        <TextInput
          style={[styles.text, isResidentSetHigh && styles.highUsage]}
          value={`MEM2: ${resources.memory.residentSet}MB`}
          editable={false}
          accessible
        />
      ) : null}
      <TextInput
        style={[styles.text, isBlinkHigh && styles.highUsage]}
        value={`Blink: ${resources.memory.blink.allocated}/${resources.memory.blink.total}MB`}
        editable={false}
        accessible
      />
    </View>
  );
}

export default SystemResources;
