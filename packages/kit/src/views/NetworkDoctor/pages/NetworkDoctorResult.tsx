import { useCallback, useMemo } from 'react';

import {
  Badge,
  Button,
  Heading,
  Icon,
  Page,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useNetworkDoctorStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import useAppNavigation from '../../../hooks/useAppNavigation';

function NetworkDoctorResult() {
  const navigation = useAppNavigation();
  const [doctorState] = useNetworkDoctorStateAtom();

  const { status, progress, result, error } = doctorState;

  const handleContactSupport = useCallback(() => {
    // TODO: Navigate to support page or open support dialog
    console.log('Contact support clicked');
  }, []);

  const handleClose = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  // Render progress view
  const renderProgress = useMemo(() => {
    if (!progress) {
      return (
        <YStack gap="$4" alignItems="center" justifyContent="center" flex={1}>
          <Icon name="LoaderSolid" size="$12" color="$iconActive" />
          <SizableText size="$bodyLg" color="$textSubdued">
            Initializing...
          </SizableText>
        </YStack>
      );
    }

    return (
      <YStack gap="$4" p="$5">
        <XStack justifyContent="space-between" alignItems="center">
          <Heading size="$headingLg">Network Diagnostics Running</Heading>
          <Badge badgeType="default" badgeSize="sm">
            <Badge.Text>{progress.percentage}%</Badge.Text>
          </Badge>
        </XStack>

        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" fontWeight="600">
              {progress.phase.replace(/_/g, ' ')}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {progress.phaseIndex} / {progress.totalPhases}
            </SizableText>
          </XStack>

          <YStack position="relative">
            <Progress value={progress.percentage} w="100%" />
            <XStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              justifyContent="center"
              alignItems="center"
              pointerEvents="none"
            >
              <SizableText size="$bodyXs" fontWeight="700" color="$text">
                {progress.percentage}%
              </SizableText>
            </XStack>
          </YStack>

          <SizableText size="$bodyMd" color="$textSubdued" mt="$2">
            {progress.message}
          </SizableText>
        </YStack>
      </YStack>
    );
  }, [progress]);

  // Render completed view
  const renderCompleted = useMemo(() => {
    if (!result) return null;

    const { summary } = result;
    const { conclusion } = summary;
    const isHealthy = summary.allCriticalChecksPassed;

    return (
      <YStack gap="$5" p="$5" flex={1}>
        <YStack gap="$4" alignItems="center">
          <Icon
            name={isHealthy ? 'CheckRadioSolid' : 'ErrorSolid'}
            size="$16"
            color={isHealthy ? '$iconSuccess' : '$iconCritical'}
          />

          <Heading size="$headingXl" textAlign="center">
            {isHealthy ? 'All Checks Passed' : 'Network Issues Detected'}
          </Heading>

          <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
            {conclusion.summary}
          </SizableText>
        </YStack>

        {/* Diagnosis Details */}
        {!isHealthy && conclusion.suggestedActions.length > 0 ? (
          <YStack gap="$3" mt="$4">
            <Heading size="$headingMd">Suggested Actions</Heading>
            <YStack
              p="$3"
              bg={
                conclusion.assessment === 'blocked'
                  ? '$bgCritical'
                  : '$bgCaution'
              }
              borderRadius="$3"
              gap="$2"
            >
              <SizableText size="$bodyMd" fontWeight="600">
                {conclusion.connectivityLevel.replace(/_/g, ' ')}
              </SizableText>
              <YStack gap="$1" pl="$3" mt="$2">
                {conclusion.suggestedActions.map((action, idx) => (
                  <SizableText key={idx} size="$bodySm" color="$textSubdued">
                    {idx + 1}. {action}
                  </SizableText>
                ))}
              </YStack>
            </YStack>
          </YStack>
        ) : null}

        {/* Intermediate Issues (Debug Info) */}
        {conclusion.intermediateIssues &&
        conclusion.intermediateIssues.length > 0 ? (
          <YStack gap="$2" mt="$2">
            <Heading size="$headingSm">Debug Info</Heading>
            {conclusion.intermediateIssues.map((issue, idx) => (
              <SizableText key={idx} size="$bodyXs" color="$textDisabled">
                • {issue}
              </SizableText>
            ))}
          </YStack>
        ) : null}

        <Stack flex={1} />

        {/* Action Buttons */}
        <YStack gap="$3">
          {!isHealthy ? (
            <Button
              variant="primary"
              onPress={handleContactSupport}
              icon="HeadsetOutline"
            >
              Contact Support
            </Button>
          ) : null}

          <Button variant="secondary" onPress={handleClose}>
            Close
          </Button>
        </YStack>
      </YStack>
    );
  }, [result, handleContactSupport, handleClose]);

  // Render error view
  const renderError = useMemo(() => {
    if (!error) return null;

    return (
      <YStack
        gap="$5"
        p="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="ErrorSolid" size="$16" color="$iconCritical" />

        <Heading size="$headingXl" textAlign="center">
          Error
        </Heading>

        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {error}
        </SizableText>

        <Button variant="primary" onPress={handleClose} mt="$4">
          Close
        </Button>
      </YStack>
    );
  }, [error, handleClose]);

  return (
    <Page>
      <Page.Header title="Network Diagnostics" />
      <Page.Body>
        {status === 'running' ? renderProgress : null}
        {status === 'completed' ? renderCompleted : null}
        {status === 'failed' ? renderError : null}
        {status === 'idle' ? (
          <YStack gap="$4" alignItems="center" justifyContent="center" flex={1}>
            <SizableText size="$bodyLg" color="$textSubdued">
              Diagnostics not started yet.
            </SizableText>
            <Button variant="secondary" onPress={handleClose}>
              Close
            </Button>
          </YStack>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default NetworkDoctorResult;
