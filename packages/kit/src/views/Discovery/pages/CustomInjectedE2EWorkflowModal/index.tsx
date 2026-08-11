import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Page, Progress, SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  getCustomInjectedE2EWorkflowActions,
  subscribeCustomInjectedE2EWorkflowActions,
} from '@onekeyhq/kit/src/utils/customInjectedE2EWorkflowRuntime';
import type { ICustomInjectedModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/customInjectedModalRoutes';
import { ECustomInjectedModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/customInjectedModalRoutes';
import type { ICustomInjectedE2EWorkflowState } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

import { CustomInjectedE2EStatusIcon } from '../../components/CustomInjectedE2EStatusIcons';

import type { ICustomInjectedE2EStatusKey } from '../../components/CustomInjectedE2EStatusIcons';
import type { RouteProp } from '@react-navigation/core';

type IWorkflowArtifactStatusColor =
  | '$textCaution'
  | '$textCritical'
  | '$textInfo'
  | '$textInteractive'
  | '$textSubdued'
  | '$textSuccess';

function WorkflowStepRow({
  action,
  active,
  artifact,
  artifactStatus,
  artifactStatusColor,
  complete,
  isLast = false,
  statusIcon,
  stepLabel,
  testID,
  title,
}: {
  action?: ReactNode;
  active: boolean;
  artifact: string;
  artifactStatus: string;
  artifactStatusColor: IWorkflowArtifactStatusColor;
  complete: boolean;
  isLast?: boolean;
  statusIcon: ICustomInjectedE2EStatusKey;
  stepLabel: string;
  testID: string;
  title: string;
}) {
  return (
    <YStack
      backgroundColor={active ? '$bgInfoSubdued' : '$transparent'}
      borderBottomColor="$borderSubdued"
      borderBottomWidth={isLast ? 0 : 1}
      borderLeftColor={active ? '$borderInfo' : 'transparent'}
      borderLeftWidth={3}
      px="$4"
      py="$3.5"
      testID={testID}
    >
      <XStack alignItems="center" gap="$3.5">
        <SizableText
          color={active ? '$textInfo' : '$textSubdued'}
          flexShrink={0}
          fontFamily="$monoRegular"
          size="$bodyXsMedium"
          width="$10"
        >
          {stepLabel}
        </SizableText>
        <YStack flex={1} gap="$2" minWidth={0}>
          <SizableText size="$bodyLgMedium">{title}</SizableText>
          <XStack alignItems="center" gap="$1.5" testID={`${testID}-description`}>
            <CustomInjectedE2EStatusIcon
              active={complete}
              status={statusIcon}
              testID={`${testID}-status-icon`}
            />
            <SizableText color="$textSubdued" size="$bodySm">
              {artifact}
            </SizableText>
            <SizableText color={artifactStatusColor} size="$bodySmMedium">
              {artifactStatus}
            </SizableText>
          </XStack>
        </YStack>
        {action ? (
          <XStack alignItems="center" flexShrink={0}>
            {action}
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

export default function CustomInjectedE2EWorkflowModal() {
  const navigation = useAppNavigation<IPageNavigationProp<ICustomInjectedModalParamList>>();
  const route =
    useRoute<RouteProp<ICustomInjectedModalParamList, ECustomInjectedModalRoutes.E2EWorkflow>>();
  const { e2eOutcome, protocolId, protocolName, recordingPhase, sessionId } = route.params;
  const [e2eState, setE2EState] = useState<ICustomInjectedE2EWorkflowState>();
  const [dappDirectory, setDappDirectory] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [openingDirectory, setOpeningDirectory] = useState(false);
  const [, setWorkflowActionsVersion] = useState(0);

  useEffect(
    () =>
      subscribeCustomInjectedE2EWorkflowActions(() => {
        setWorkflowActionsVersion((version) => version + 1);
      }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const [next, directory] = await Promise.all([
          globalThis.desktopApiProxy.webview.getCustomInjectedE2EState(sessionId, protocolId),
          globalThis.desktopApiProxy.webview.getCustomInjectedDappDirectory(sessionId, protocolId),
        ]);
        if (!disposed) {
          setE2EState(next);
          setDappDirectory(directory);
          setLoadError(undefined);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [protocolId, sessionId]);

  const workflowActions = getCustomInjectedE2EWorkflowActions({
    protocolId,
    sessionId,
  });
  const generationRunning = workflowActions?.e2eGenerating === true;
  const validationRunning = workflowActions?.e2eRunning === true;
  let validationActionLabel = 'Validate';
  if (validationRunning) {
    validationActionLabel = 'Stop';
  } else if (e2eOutcome || e2eState?.validation?.current) {
    validationActionLabel = 'Run again';
  }
  const recordingBusy = Boolean(recordingPhase);
  const recordingInProgress = recordingPhase === 'recording';
  const hasRecording = Boolean(e2eState?.recording);
  const hasCurrentE2E = Boolean(e2eState?.e2e?.current);
  const persistedValidation = e2eState?.validation?.current ? e2eState.validation : undefined;
  const hasAdapter = Boolean(e2eState?.adapter);
  const needsE2EGeneration = hasRecording && !hasCurrentE2E;
  const validationPassed = e2eOutcome ? e2eOutcome.passed : Boolean(persistedValidation?.passed);
  const requiredCompletedCount =
    Number(hasRecording) + Number(hasCurrentE2E) + Number(validationPassed);
  const completionPercentage = Math.round((requiredCompletedCount / 3) * 100);

  let currentStep = 1;
  if (generationRunning || (!recordingBusy && needsE2EGeneration)) {
    currentStep = 2;
  } else if (!recordingBusy && hasCurrentE2E) {
    currentStep = 3;
  }
  if (validationRunning || e2eOutcome) {
    currentStep = 3;
  }

  let recordingStatus = 'Ready';
  const recordingDetail = 'recording.json';
  let recordingDetailStatus = 'not recorded.';
  let recordingDetailStatusColor: '$textInfo' | '$textSubdued' = '$textSubdued';
  if (recordingPhase) {
    const recordingPhaseStatus = {
      preparing: 'Preparing…',
      recording: 'Recording…',
      saving: 'Saving…',
      stopping: 'Stopping…',
    } as const;
    recordingStatus = recordingPhaseStatus[recordingPhase];
    recordingDetailStatus = recordingPhaseStatus[recordingPhase].toLowerCase();
    recordingDetailStatusColor = '$textInfo';
  } else if (e2eState?.recording) {
    recordingStatus = 'Recorded';
    recordingDetailStatus = 'recorded.';
    recordingDetailStatusColor = '$textInfo';
  }

  const generateDetail = 'e2e.mjs';
  let generateDetailStatus = 'not generated.';
  let generateDetailStatusColor: '$textCaution' | '$textCritical' | '$textInfo' | '$textSubdued' =
    '$textSubdued';
  if (generationRunning) {
    generateDetailStatus = 'generating and validating…';
    generateDetailStatusColor = '$textInfo';
  } else if (hasCurrentE2E) {
    generateDetailStatus = 'generated.';
    generateDetailStatusColor = '$textCaution';
  } else if (needsE2EGeneration) {
    generateDetailStatus = 'requires re-recording.';
    generateDetailStatusColor = '$textCritical';
  }

  const validationDetail = 'E2E';
  let validationDetailStatus = 'not validated.';
  let validationDetailStatusColor: '$textCritical' | '$textInfo' | '$textSubdued' | '$textSuccess' =
    '$textSubdued';
  if (validationRunning) {
    validationDetailStatus = 'validating…';
    validationDetailStatusColor = '$textInfo';
  } else if (e2eOutcome) {
    validationDetailStatus = e2eOutcome.passed ? 'passed.' : 'failed.';
    validationDetailStatusColor = e2eOutcome.passed ? '$textSuccess' : '$textCritical';
  } else if (persistedValidation) {
    validationDetailStatus = persistedValidation.passed ? 'passed.' : 'failed.';
    validationDetailStatusColor = persistedValidation.passed ? '$textSuccess' : '$textCritical';
  } else if (e2eState?.canValidate) {
    validationDetailStatus = 'ready to validate.';
    validationDetailStatusColor = '$textInfo';
  }

  let recordingButtonLabel = hasRecording ? 'Re-record' : 'Record';
  if (recordingPhase === 'recording') {
    recordingButtonLabel = 'Stop recording';
  } else if (recordingPhase) {
    recordingButtonLabel = recordingStatus;
  }

  const closeThen = (action: () => void) => {
    navigation.pop();
    action();
  };
  const errorLog = e2eOutcome && !e2eOutcome.passed ? e2eOutcome.errorLog : undefined;
  const openDappDirectory = useCallback(async () => {
    if (openingDirectory) return;
    setOpeningDirectory(true);
    try {
      await globalThis.desktopApiProxy.webview.openCustomInjectedDappDirectory(
        sessionId,
        protocolId,
      );
      setLoadError(undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningDirectory(false);
    }
  }, [openingDirectory, protocolId, sessionId]);

  return (
    <Page>
      <Page.Header title="E2E workflow" />
      <Page.Body>
        <YStack gap="$4" px="$5" pb="$5">
          <YStack
            backgroundColor="$bgStrong"
            borderColor="$borderSubdued"
            borderRadius="$3"
            borderWidth={1}
            gap="$3"
            p="$4"
            testID="custom-injected-e2e-progress-summary"
          >
            <XStack alignItems="center" gap="$4" justifyContent="space-between">
              <YStack flex={1} gap="$1" minWidth={0}>
                <SizableText numberOfLines={1} size="$bodyLgMedium">
                  {protocolName}
                </SizableText>
                <SizableText color="$textSubdued" size="$bodySm">
                  Only the latest recording and generated artifacts are kept.
                </SizableText>
              </YStack>
              {!e2eState && !loadError ? (
                <Spinner size="small" />
              ) : (
                <SizableText color="$textSubdued" flexShrink={0} size="$bodySmMedium">
                  {`${String(requiredCompletedCount)} / 3 complete`}
                </SizableText>
              )}
            </XStack>
            <Progress testID="custom-injected-e2e-progress" value={completionPercentage} />
          </YStack>
          {loadError ? (
            <SizableText color="$textCritical" size="$bodySm">
              {loadError}
            </SizableText>
          ) : null}
          <YStack
            backgroundColor="$bgStrong"
            borderColor="$borderSubdued"
            borderRadius="$3"
            borderWidth={1}
            overflow="hidden"
            testID="custom-injected-e2e-workflow-panel"
          >
            <WorkflowStepRow
              action={
                <Button
                  color={recordingInProgress ? undefined : '$textInfo'}
                  disabled={
                    !workflowActions ||
                    generationRunning ||
                    validationRunning ||
                    Boolean(recordingPhase && recordingPhase !== 'recording')
                  }
                  icon={recordingInProgress ? 'StopCircleSolid' : 'RecordCircleOutline'}
                  iconColor={recordingInProgress ? undefined : '$iconInfo'}
                  loading={Boolean(recordingPhase && !recordingInProgress)}
                  size="small"
                  testID="custom-injected-e2e-workflow-record"
                  variant={recordingInProgress ? 'destructive' : 'secondary'}
                  onPress={() => {
                    if (!workflowActions) return;
                    closeThen(
                      recordingInProgress
                        ? workflowActions.stopRecording
                        : workflowActions.startRecording,
                    );
                  }}
                >
                  {recordingButtonLabel}
                </Button>
              }
              active={currentStep === 1}
              artifact={recordingDetail}
              artifactStatus={recordingDetailStatus}
              artifactStatusColor={recordingDetailStatusColor}
              complete={hasRecording}
              statusIcon="recorded"
              stepLabel="01"
              testID="custom-injected-e2e-step-record"
              title="Record"
            />
            <WorkflowStepRow
              action={
                generationRunning ? (
                  <XStack alignItems="center" gap="$1.5">
                    <Spinner
                      color="$iconCritical"
                      size="small"
                      testID="custom-injected-e2e-workflow-generation-stop-spinner"
                    />
                    <Button
                      color="$textCritical"
                      icon="StopCircleSolid"
                      iconColor="$iconCritical"
                      size="small"
                      testID="custom-injected-e2e-workflow-generation-stop"
                      variant="secondary"
                      onPress={() => workflowActions?.stopE2EGeneration()}
                    >
                      Stop
                    </Button>
                  </XStack>
                ) : undefined
              }
              active={currentStep === 2}
              artifact={generateDetail}
              artifactStatus={generateDetailStatus}
              artifactStatusColor={generateDetailStatusColor}
              complete={hasCurrentE2E}
              statusIcon="generated"
              stepLabel="02"
              testID="custom-injected-e2e-step-generate"
              title="Generate E2E"
            />
            <WorkflowStepRow
              action={
                errorLog || e2eState?.canValidate ? (
                  <XStack alignItems="center" gap="$1.5">
                    {errorLog ? (
                      <Button
                        color="$textCritical"
                        size="small"
                        testID="custom-injected-e2e-view-error"
                        variant="tertiary"
                        onPress={() =>
                          navigation.push(ECustomInjectedModalRoutes.E2EErrorDetail, {
                            errorLog,
                            protocolName,
                          })
                        }
                      >
                        View error
                      </Button>
                    ) : null}
                    {e2eState?.canValidate ? (
                      <XStack alignItems="center" gap="$1.5">
                        {validationRunning ? (
                          <Spinner
                            color="$iconCritical"
                            size="small"
                            testID="custom-injected-e2e-workflow-stop-spinner"
                          />
                        ) : null}
                        <Button
                          color={validationRunning ? '$textCritical' : '$textSuccess'}
                          disabled={!workflowActions || generationRunning}
                          icon={validationRunning ? 'StopCircleSolid' : 'PlayCircleOutline'}
                          iconColor={validationRunning ? '$iconCritical' : '$iconSuccess'}
                          size="small"
                          testID="custom-injected-e2e-workflow-validate"
                          variant="secondary"
                          onPress={() => {
                            if (!workflowActions) return;
                            if (validationRunning) {
                              workflowActions.stopE2E();
                              return;
                            }
                            closeThen(() => {
                              void workflowActions.validateE2E();
                            });
                          }}
                        >
                          {validationActionLabel}
                        </Button>
                      </XStack>
                    ) : null}
                  </XStack>
                ) : undefined
              }
              active={currentStep === 3}
              artifact={validationDetail}
              artifactStatus={validationDetailStatus}
              artifactStatusColor={validationDetailStatusColor}
              complete={validationPassed}
              statusIcon="validated"
              stepLabel="03"
              testID="custom-injected-e2e-step-validate"
              title="Validate E2E"
            />
            <WorkflowStepRow
              active={false}
              artifact="adapter.ts"
              artifactStatus={hasAdapter ? 'generated.' : 'not generated.'}
              artifactStatusColor={hasAdapter ? '$textInteractive' : '$textSubdued'}
              complete={hasAdapter}
              isLast
              statusIcon="adapter"
              stepLabel="OPT"
              testID="custom-injected-e2e-step-adapter"
              title="Adapter"
            />
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <XStack
          alignItems="center"
          gap="$3"
          px="$5"
          py="$3"
          testID="custom-injected-e2e-directory-bar"
        >
          <YStack flex={1} gap="$1" minWidth={0}>
            <SizableText color="$textSubdued" size="$bodySmMedium">
              DApp config directory
            </SizableText>
            <SizableText
              color="$textSubdued"
              fontFamily="$monoRegular"
              selectable
              size="$bodySm"
              testID="custom-injected-e2e-directory-path"
            >
              {dappDirectory || 'Resolving directory…'}
            </SizableText>
          </YStack>
          <Button
            disabled={!dappDirectory || openingDirectory}
            icon="FolderOpenOutline"
            loading={openingDirectory}
            testID="custom-injected-e2e-open-directory"
            variant="secondary"
            onPress={() => {
              void openDappDirectory();
            }}
          >
            Open
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}
