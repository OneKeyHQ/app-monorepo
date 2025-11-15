import { useCallback, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import type {
  DoctorConfig,
  NetworkCheckup,
} from '@onekeyhq/shared/src/modules/NetworkDoctor';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const NetworkDoctorGallery = () => {
  const [loading, setLoading] = useState(false);

  const handleRunDiagnostics = useCallback(async () => {
    if (!platformEnv.isNative) {
      console.error(
        'Network Doctor only works on native clients because it requires native modules.',
      );
      return;
    }

    setLoading(true);
    try {
      // Dynamic import for native platforms only
      const module = await import('@onekeyhq/shared/src/modules/NetworkDoctor');
      const { runNetworkDoctor } = module as unknown as {
        runNetworkDoctor: (config: DoctorConfig) => Promise<NetworkCheckup>;
      };

      const report = await runNetworkDoctor({
        targetDomain: 'wallet.onekeytest.com',
        healthCheckPath: '/wallet/v1/health',
      });

      console.log('🩺 Network Doctor Report:', report);
      console.log('Assessment:', report.summary.assessment);
      console.log('Issues:', report.summary.issues);
      console.log('Metrics:', report.metrics);
    } catch (error) {
      console.error('Network diagnostics failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="Network Doctor"
      description="Run comprehensive network diagnostics. Check console for results. Native only."
      elements={[
        {
          title: 'Network Diagnostics (Native Only)',
          element: (
            <YStack gap="$4">
              <SizableText size="$bodySm" color="$textSubdued">
                Click the button to run network diagnostics. Results will be
                logged to the console.
              </SizableText>

              <Button
                variant="primary"
                onPress={handleRunDiagnostics}
                loading={loading}
                disabled={loading}
              >
                Run Network Diagnostics
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default NetworkDoctorGallery;
