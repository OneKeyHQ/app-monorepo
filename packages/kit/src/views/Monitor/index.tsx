import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Input,
  ScrollView,
  Switch,
  Text,
  Typography,
} from '@onekeyhq/components';
import type { metrixUpdateInfo } from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import {
  getMeasureTime,
  getUsedBatterySinceStartup,
  startRecordingMetrics,
  stopRecordingMetrics,
  subscribeToMetrics,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import { AppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

export const MonitorSettings = () => {
  const [isRecording, changeRecordingStatus] = useState(
    appStorage.getSettingBoolean(AppSettingKey.perf_switch),
  );
  const [usedBattery, setUsedBattery] = useState<number>();
  const [metricsLivingData, setMetricsLivingData] =
    useState<metrixUpdateInfo>();
  const measureTime = getMeasureTime();
  useEffect(() => {
    getUsedBatterySinceStartup().then((batteryLevel) => {
      setUsedBattery(batteryLevel);
    });
    const unsubscribe = subscribeToMetrics(setMetricsLivingData);
    return () => {
      unsubscribe();
    };
  }, []);
  return (
    <ScrollView p={4} flex="1" bg="background-hovered">
      <Box py={4} />
      <Typography.Heading>Enable Metrics Recording</Typography.Heading>
      <Switch
        testID="MetricsSwitch"
        mr={1}
        labelType="false"
        isChecked={isRecording}
        onToggle={() => {
          const nextValue = !isRecording;
          changeRecordingStatus(nextValue);
          appStorage.setSetting(AppSettingKey.perf_switch, nextValue);
          if (!nextValue) {
            stopRecordingMetrics();
            setMetricsLivingData(undefined);
          }
        }}
      />
      <Box py={4} />
      <Typography.Heading>
        Upload metrics to regression Testing server
      </Typography.Heading>
      <Box flexDirection="row" flex={1} w="100%" alignItems="center">
        <Input testID="UnitTestingNameInput" placeholder="Unit testing name" />
        <Button
          testID="UnitTestingUploadButton"
          type="primary"
          onPress={() => {
            setTimeout(() => {
              alert('file uploaded successfully');
            }, 1500);
          }}
        >
          Upload
        </Button>
      </Box>

      <Box py={4} />
      <Typography.Heading>Living Data</Typography.Heading>
      <Typography.Body2>
        jsBundleLoadedTime: {measureTime.jsBundleLoadedTime}
      </Typography.Body2>
      <Typography.Body2>fpTime: {measureTime.fpTime}</Typography.Body2>
      <Typography.Body2>jsFps: {metricsLivingData?.jsFps}</Typography.Body2>
      <Typography.Body2>uiFps: {metricsLivingData?.uiFps}</Typography.Body2>
      <Typography.Body2>
        usedCpu: {metricsLivingData?.usedCpu.toFixed(2)}%
      </Typography.Body2>
      <Typography.Body2>
        usedRam:{' '}
        {`${((metricsLivingData?.usedRam || 0) / 1024 / 1024).toFixed(2)} Mb`}
      </Typography.Body2>
      <Typography.Body2>usedBattery: {usedBattery}</Typography.Body2>
    </ScrollView>
  );
};
