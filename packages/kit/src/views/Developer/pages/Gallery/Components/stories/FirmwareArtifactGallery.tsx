import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Heading,
  Progress,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeveloperTestIDs } from '@onekeyhq/kit/src/views/Developer/testIDs';
import type {
  IFirmwareArtifactSelfTestScenario,
  IFirmwareArtifactSelfTestState,
} from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/FirmwareArtifactSelfTest';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const scenarios: {
  scenario: IFirmwareArtifactSelfTestScenario;
  title: string;
  description: string;
  testID: string;
}[] = [
  {
    scenario: 'pro-firmware',
    title: 'Validate Pro firmware',
    description:
      'Raw firmware, SDK contract, and 50 cached native bridge cycles',
    testID: DeveloperTestIDs.firmwareArtifactRunFirmware,
  },
  {
    scenario: 'pro-resource',
    title: 'Validate incremental resource',
    description: 'ZIP download, reader, and exact materialization',
    testID: DeveloperTestIDs.firmwareArtifactRunResource,
  },
  {
    scenario: 'pro-full-resource',
    title: 'Validate full resource',
    description: 'Large ZIP, approximately 84 MB',
    testID: DeveloperTestIDs.firmwareArtifactRunFullResource,
  },
];

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

const formatDuration = (state: IFirmwareArtifactSelfTestState): string => {
  const end = state.completedAt ?? state.updatedAt;
  return `${((end - state.startedAt) / 1000).toFixed(1)} s`;
};

function FirmwareArtifactStatus({
  state,
}: {
  state: IFirmwareArtifactSelfTestState;
}) {
  return (
    <YStack
      testID={DeveloperTestIDs.firmwareArtifactStatus}
      gap="$3"
      p="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg="$bgSubdued"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <YStack flex={1} gap="$1">
          <Heading size="$headingMd">{state.descriptor.label}</Heading>
          <SizableText size="$bodySm" color="$textSubdued">
            Version {state.descriptor.version} · {state.platform}
          </SizableText>
        </YStack>
        <Badge badgeType="default" badgeSize="sm">
          <Badge.Text>{state.status.toUpperCase()}</Badge.Text>
        </Badge>
      </XStack>

      <Progress value={state.progress} />

      <YStack gap="$1">
        <SizableText size="$bodySm">Phase: {state.phase}</SizableText>
        <SizableText size="$bodySm">
          Expected: {formatBytes(state.descriptor.expectedSize)}
        </SizableText>
        <SizableText size="$bodySm">
          Reader: {formatBytes(state.bytesRead)} in {state.chunkCount} chunks
        </SizableText>
        <SizableText size="$bodySm">
          Materialized entries: {state.materializedEntryCount}
        </SizableText>
        {state.descriptor.scenario === 'pro-firmware' ? (
          <SizableText size="$bodySm">
            Bridge stress: {state.stressCompletedIterations} / 50
          </SizableText>
        ) : null}
        <SizableText size="$bodySm">
          SDK entry: {state.sdkEntryValidated ? 'validated' : 'pending'}
        </SizableText>
        <SizableText size="$bodySm">
          SDK integrity rejection:{' '}
          {state.sdkIntegrityRejected ? 'validated' : 'pending'}
        </SizableText>
        <SizableText size="$bodySm">
          SDK binding release:{' '}
          {state.sdkBindingReleased ? 'validated' : 'pending'}
        </SizableText>
        {state.sdkBoundaryCode ? (
          <SizableText size="$bodySm">
            SDK device boundary: {state.sdkBoundaryCode}
          </SizableText>
        ) : null}
        <SizableText size="$bodySm">
          GC: {state.deletedFiles} files / {formatBytes(state.deletedBytes)}
        </SizableText>
        <SizableText size="$bodySm">
          Duration: {formatDuration(state)}
        </SizableText>
        {state.errorCode ? (
          <SizableText size="$bodySm" color="$textCritical">
            Error: {state.errorCode}
          </SizableText>
        ) : null}
      </YStack>

      <SizableText size="$bodyXs" color="$textSubdued" selectable>
        Run ID: {state.runId}
      </SizableText>
    </YStack>
  );
}

function FirmwareArtifactValidator() {
  const [state, setState] = useState<
    IFirmwareArtifactSelfTestState | undefined
  >();
  const [startingScenario, setStartingScenario] = useState<
    IFirmwareArtifactSelfTestScenario | undefined
  >();
  const [uiError, setUiError] = useState<string>();

  const refresh = useCallback(async () => {
    const next =
      await backgroundApiProxy.serviceFirmwareUpdate.getFirmwareArtifactSelfTestState();
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (state?.status !== 'running') return undefined;
    const timer = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(timer);
  }, [refresh, state?.status]);

  const start = useCallback(
    async (scenario: IFirmwareArtifactSelfTestScenario) => {
      setStartingScenario(scenario);
      setUiError(undefined);
      try {
        const next =
          await backgroundApiProxy.serviceFirmwareUpdate.startFirmwareArtifactSelfTest(
            { scenario },
          );
        setState(next);
      } catch (error) {
        setUiError(error instanceof Error ? error.message : String(error));
      } finally {
        setStartingScenario(undefined);
      }
    },
    [],
  );

  const platformSupported = platformEnv.isNative || platformEnv.isDesktop;
  const running = state?.status === 'running';

  return (
    <YStack testID={DeveloperTestIDs.firmwareArtifactScreen} gap="$5">
      <YStack gap="$2">
        <Heading size="$headingLg">Pro 4.21.0 artifacts</Heading>
        <SizableText color="$textSubdued">
          Runs in the background runtime through the production Desktop or
          native artifact adapter. No OneKey device is required.
        </SizableText>
      </YStack>

      {state ? <FirmwareArtifactStatus state={state} /> : null}

      {scenarios.map((item) => (
        <YStack
          key={item.scenario}
          gap="$3"
          p="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
        >
          <YStack gap="$1">
            <Heading size="$headingSm">{item.title}</Heading>
            <SizableText size="$bodySm" color="$textSubdued">
              {item.description}
            </SizableText>
          </YStack>
          <Button
            testID={item.testID}
            disabled={!platformSupported || running}
            loading={startingScenario === item.scenario}
            onPress={() => start(item.scenario)}
          >
            Run validation
          </Button>
        </YStack>
      ))}

      {uiError ? (
        <SizableText color="$textCritical">UI error: {uiError}</SizableText>
      ) : null}

      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Filter app-latest.log by firmwareArtifactSelfTest or the Run ID.
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          A cached artifact is still integrity-checked. Clear App data before a
          run when a fresh network transfer is required.
        </SizableText>
      </YStack>
    </YStack>
  );
}

const FirmwareArtifactGallery = () => (
  <Layout
    componentName="Firmware Artifact Validator"
    getFilePath={() => __CURRENT_FILE_PATH__}
  >
    <FirmwareArtifactValidator />
  </Layout>
);

export default FirmwareArtifactGallery;
