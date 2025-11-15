/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useState } from 'react';

import {
  Badge,
  Button,
  Heading,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { INetworkCheckup } from '@onekeyhq/shared/src/modules/NetworkDoctor';
import { NetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { Layout } from './utils/Layout';

const NetworkDoctorGallery = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<INetworkCheckup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const doctor = new NetworkDoctor({
        serviceName: EServiceEndpointEnum.Wallet,
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

    const getSeverityBg = (severity: string) => {
      if (severity === 'critical') return '$bgCritical';
      if (severity === 'warning') return '$bgCaution';
      return '$bgInfo';
    };

    const getSeverityIcon = (severity: string) => {
      if (severity === 'critical') return '🚨';
      if (severity === 'warning') return '⚠️';
      return 'ℹ️';
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
            {summary.assessment.toUpperCase()}
          </Badge>
        </XStack>

        {summary.allCriticalChecksPassed ? (
          <SizableText size="$bodyMd" color="$textSuccess">
            All critical checks passed!
          </SizableText>
        ) : (
          <YStack gap="$2">
            {summary.issues.map((issue, idx) => (
              <YStack
                key={idx}
                gap="$1"
                p="$2"
                bg={getSeverityBg(issue.severity)}
                borderRadius="$2"
              >
                <SizableText size="$bodySm" fontWeight="600">
                  {getSeverityIcon(issue.severity)} {issue.message}
                </SizableText>
                {issue.suggestedSolutions &&
                issue.suggestedSolutions.length > 0 ? (
                  <YStack gap="$1" pl="$3">
                    <SizableText size="$bodyXs" color="$textSubdued">
                      💡 Solutions:
                    </SizableText>
                    {issue.suggestedSolutions.map((solution, sIdx) => (
                      <SizableText
                        key={sIdx}
                        size="$bodyXs"
                        color="$textSubdued"
                      >
                        {sIdx + 1}. {solution}
                      </SizableText>
                    ))}
                  </YStack>
                ) : null}
              </YStack>
            ))}
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
