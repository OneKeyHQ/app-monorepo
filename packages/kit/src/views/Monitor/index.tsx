import { useEffect, useState } from 'react';

import {
  getBrand,
  getBuildNumber,
  getDeviceId,
  getModel,
  getSystemName,
  getSystemVersion,
} from 'react-native-device-info';

import {
  Box,
  Button,
  Input,
  ScrollView,
  Switch,
  Typography,
} from '@onekeyhq/components';
import type { MetrixDeviceInfo, metrixUpdateInfo } from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import {
  getMeasureTime,
  getUsedBatterySinceStartup,
  stopRecordingMetrics,
  subscribeToMetrics,
  uploadMetricsInfo,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import { AppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

export const MonitorSettings = () => {
  const [isRecording, changeRecordingStatus] = useState(
    appStorage.getSettingBoolean(AppSettingKey.perf_switch),
  );
  const [deviceInfo, setDeviceInfo] = useState<MetrixDeviceInfo>();
  const [usedBattery, setUsedBattery] = useState<number>();
  const [unitTestName, setUnitTestName] = useState<string>();
  const [uploadPassword, setUploadPassword] = useState<string>();
  const [metricsLivingData, setMetricsLivingData] =
    useState<metrixUpdateInfo>();
  const measureTime = getMeasureTime();
  useEffect(() => {
    (async () => {
      setUsedBattery(await getUsedBatterySinceStartup());
      setDeviceInfo({
        commitHash: process.env.GITHUB_SHA || '',
        brand: getBrand(),
        buildNumber: getBuildNumber() || '',
        deviceId: getDeviceId() || '',
        model: getModel(),
        systemName: getSystemName(),
        systemVersion: getSystemVersion(),
      });
    })();
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
      <Box flex={1} w="100%">
        <Input
          testID="UnitTestingNameInput"
          placeholder="Unit testing name"
          onChangeText={setUnitTestName}
          value={unitTestName}
        />
        <Box py={1} />
        <Input
          testID="UnitTestingPasswordInput"
          placeholder="Password for uploading log file"
          value={uploadPassword}
          onChangeText={setUploadPassword}
        />
        <Box py={1} />
        <Button
          testID="UnitTestingUploadButton"
          type="primary"
          onPress={async () => {
            try {
              if (unitTestName && uploadPassword) {
                stopRecordingMetrics();
                const result = await uploadMetricsInfo(
                  unitTestName,
                  uploadPassword,
                  deviceInfo,
                );
                alert(result?.body || result?.statusCode);
              }
            } catch (error: unknown) {
              alert(JSON.stringify(error));
            }
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
      <Box py={4} />
      <Typography.Heading>Device Info</Typography.Heading>
      <Typography.Body2>commitHash: {deviceInfo?.commitHash}</Typography.Body2>
      <Typography.Body2>brand: {deviceInfo?.brand}</Typography.Body2>
      <Typography.Body2>
        buildNumber: {deviceInfo?.buildNumber}
      </Typography.Body2>
      <Typography.Body2>deviceId: {deviceInfo?.deviceId}</Typography.Body2>
      <Typography.Body2>model: {deviceInfo?.model}</Typography.Body2>
      <Typography.Body2>systemName: {deviceInfo?.systemName}</Typography.Body2>
      <Typography.Body2>
        systemVersion: {deviceInfo?.systemVersion}
      </Typography.Body2>
    </ScrollView>
  );
};
