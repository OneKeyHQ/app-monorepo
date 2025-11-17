/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useState } from 'react';

import {
  Badge,
  Button,
  Heading,
  Progress,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IDiagnosticProgress,
  INetworkCheckup,
} from '@onekeyhq/shared/src/modules/NetworkDoctor';
import { NetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';

import { Layout } from './utils/Layout';

const NetworkDoctorGallery = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<INetworkCheckup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<IDiagnosticProgress | null>(null);

  const handleRunDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const doctor = new NetworkDoctor({
        onProgress: (progressData) => {
          setProgress(progressData);
          console.log(
            `[${progressData.percentage}%] ${progressData.phase}: ${progressData.message}`,
          );
        },
      });

      const report = await doctor.run();

      setResult(report);
      console.log('🩺 Network Doctor Report:', report);
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      setError(errorMessage);
      console.error('Network diagnostics failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const renderStatus = () => {
    if (!result) return null;

    const { summary } = result;
    const { conclusion } = summary;

    const getBg = (assessment: string) => {
      if (assessment === 'blocked') return '$bgCritical';
      if (assessment === 'degraded') return '$bgCaution';
      return '$bgInfo';
    };

    return (
      <YStack
        gap="$2"
        bg="$bg"
        p="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <XStack gap="$2" alignItems="center">
          <Heading size="$headingMd">
            {summary.allCriticalChecksPassed ? '✅' : '🔍'} Status
          </Heading>
          <Badge badgeType="default" badgeSize="sm">
            <Badge.Text>{summary.assessment.toUpperCase()}</Badge.Text>
          </Badge>
        </XStack>

        {summary.allCriticalChecksPassed ? (
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSuccess" fontWeight="600">
              {conclusion.summary}
            </SizableText>
            {conclusion.intermediateIssues &&
            conclusion.intermediateIssues.length > 0 ? (
              <YStack gap="$1" mt="$2" p="$2" bg="$bgSubdued" borderRadius="$2">
                <SizableText size="$bodyXs" color="$textSubdued">
                  ⚙️ Debug Info:
                </SizableText>
                {conclusion.intermediateIssues.map((issue, idx) => (
                  <SizableText key={idx} size="$bodyXs" color="$textDisabled">
                    • {issue}
                  </SizableText>
                ))}
              </YStack>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$2">
            <YStack
              gap="$1"
              p="$2"
              bg={getBg(conclusion.assessment)}
              borderRadius="$2"
            >
              <SizableText size="$bodySm" fontWeight="600">
                {conclusion.connectivityLevel.replace(/_/g, ' ')}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {conclusion.summary}
              </SizableText>
              {conclusion.suggestedActions.length > 0 ? (
                <YStack gap="$1" pl="$3" mt="$1">
                  <SizableText size="$bodyXs" color="$textSubdued">
                    💡 Suggested Actions:
                  </SizableText>
                  {conclusion.suggestedActions.map((action, idx) => (
                    <SizableText key={idx} size="$bodyXs" color="$textSubdued">
                      {idx + 1}. {action}
                    </SizableText>
                  ))}
                </YStack>
              ) : null}
            </YStack>
          </YStack>
        )}
      </YStack>
    );
  };

  const renderTcpComparison = () => {
    if (!result?.results.tcpTests) return null;

    const { tcpTests } = result.results;

    return (
      <YStack
        gap="$2"
        bg="$bg"
        p="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <Heading size="$headingMd">🔌 TCP Connection Comparison</Heading>
        <YStack gap="$1">
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">
              Your API ({tcpTests.yourApi.host})
            </SizableText>
            <SizableText
              size="$bodySm"
              color={
                tcpTests.yourApi.success ? '$textSuccess' : '$textCritical'
              }
            >
              {tcpTests.yourApi.success
                ? `✅ ${tcpTests.yourApi.tcpHandshakeTime ?? 'N/A'}ms`
                : '❌ Failed'}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">Google (www.google.com)</SizableText>
            <SizableText
              size="$bodySm"
              color={tcpTests.google.success ? '$textSuccess' : '$textCritical'}
            >
              {tcpTests.google.success
                ? `✅ ${tcpTests.google.tcpHandshakeTime ?? 'N/A'}ms`
                : '❌ Failed'}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">Cloudflare (1.1.1.1)</SizableText>
            <SizableText
              size="$bodySm"
              color={
                tcpTests.cloudflare.success ? '$textSuccess' : '$textCritical'
              }
            >
              {tcpTests.cloudflare.success
                ? `✅ ${tcpTests.cloudflare.tcpHandshakeTime ?? 'N/A'}ms`
                : '❌ Failed'}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    );
  };

  const renderNetworkEnv = () => {
    if (!result?.results.networkEnv) return null;

    const { networkEnv } = result.results;

    return (
      <YStack
        gap="$2"
        bg="$bg"
        p="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <Heading size="$headingMd">🌐 Network Environment</Heading>
        <YStack gap="$1">
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">IP Address:</SizableText>
            <SizableText size="$bodySm">
              {networkEnv.ipAddress || 'N/A'}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">Gateway:</SizableText>
            <SizableText size="$bodySm">
              {networkEnv.gateway || 'N/A'}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">Subnet:</SizableText>
            <SizableText size="$bodySm">
              {networkEnv.subnet || 'N/A'}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    );
  };

  const renderMetrics = () => {
    if (!result?.metrics) return null;

    const { metrics } = result;

    return (
      <YStack
        gap="$2"
        bg="$bg"
        p="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <Heading size="$headingMd">📊 Performance Metrics</Heading>
        <YStack gap="$1">
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm">Total Duration:</SizableText>
            <SizableText size="$bodySm">
              {metrics.totalDurationMs}ms
            </SizableText>
          </XStack>
          {metrics.dnsResolutionMs != null ? (
            <XStack justifyContent="space-between">
              <SizableText size="$bodySm">DNS Resolution:</SizableText>
              <SizableText size="$bodySm">
                {metrics.dnsResolutionMs}ms
              </SizableText>
            </XStack>
          ) : null}
          {metrics.tcpHandshakeMs != null ? (
            <XStack justifyContent="space-between">
              <SizableText size="$bodySm">TCP Handshake:</SizableText>
              <SizableText size="$bodySm">
                {metrics.tcpHandshakeMs}ms
              </SizableText>
            </XStack>
          ) : null}
          {metrics.tlsHandshakeMs != null ? (
            <XStack justifyContent="space-between">
              <SizableText size="$bodySm">TLS Handshake:</SizableText>
              <SizableText size="$bodySm">
                {metrics.tlsHandshakeMs}ms
              </SizableText>
            </XStack>
          ) : null}
          {metrics.httpRequestMs != null ? (
            <XStack justifyContent="space-between">
              <SizableText size="$bodySm">HTTP Request:</SizableText>
              <SizableText size="$bodySm">
                {metrics.httpRequestMs}ms
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    );
  };

  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="Network Doctor"
      description="Comprehensive network diagnostics for detecting connectivity issues and SNI blocking. Native platforms only."
      elements={[
        {
          title: 'Network Diagnostics',
          element: (
            <YStack gap="$4">
              <YStack gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  Diagnose network connectivity to wallet.onekeytest.com and
                  detect potential blocking issues.
                </SizableText>

                <Button
                  variant="primary"
                  onPress={handleRunDiagnostics}
                  disabled={loading}
                  icon={loading ? <Spinner size="small" /> : undefined}
                >
                  {loading
                    ? 'Running Diagnostics...'
                    : 'Run Network Diagnostics'}
                </Button>
              </YStack>

              {loading && progress ? (
                <YStack
                  gap="$2"
                  bg="$bgSubdued"
                  p="$3"
                  borderRadius="$3"
                  borderWidth={1}
                  borderColor="$borderSubdued"
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <SizableText size="$bodySm" fontWeight="600">
                      {progress.phase.replace(/_/g, ' ')}
                    </SizableText>
                    <Badge badgeType="default" badgeSize="sm">
                      <Badge.Text>{progress.percentage}%</Badge.Text>
                    </Badge>
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
                      <SizableText
                        size="$bodyXs"
                        fontWeight="700"
                        color="$text"
                      >
                        {progress.percentage}%
                      </SizableText>
                    </XStack>
                  </YStack>
                  <SizableText size="$bodyXs" color="$textSubdued">
                    {progress.message}
                  </SizableText>
                  <SizableText size="$bodyXs" color="$textSubdued">
                    Phase {progress.phaseIndex} of {progress.totalPhases} -{' '}
                    {progress.percentage}%
                  </SizableText>
                </YStack>
              ) : null}

              {error ? (
                <YStack gap="$2" bg="$bgCritical" p="$3" borderRadius="$3">
                  <SizableText
                    size="$bodySm"
                    color="$textCritical"
                    fontWeight="600"
                  >
                    ❌ Error
                  </SizableText>
                  <SizableText size="$bodySm" color="$textCritical">
                    {error}
                  </SizableText>
                </YStack>
              ) : null}

              {result ? (
                <YStack gap="$3">
                  {renderStatus()}
                  {renderTcpComparison()}
                  {renderNetworkEnv()}
                  {renderMetrics()}

                  <YStack
                    gap="$2"
                    bg="$bg"
                    p="$3"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor="$borderSubdued"
                  >
                    <Heading size="$headingMd">
                      📋 Full Report (Console)
                    </Heading>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Complete diagnostic data has been logged to the console.
                      Check developer tools for details.
                    </SizableText>
                  </YStack>
                </YStack>
              ) : null}

              {!loading && !result && !error ? (
                <YStack
                  bg="$bgSubdued"
                  p="$4"
                  borderRadius="$3"
                  alignItems="center"
                >
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    Press "Run Network Diagnostics" to start comprehensive
                    network analysis.
                  </SizableText>
                </YStack>
              ) : null}
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default NetworkDoctorGallery;
