import { useCallback, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { runNetworkDoctor } from '@onekeyhq/shared/src/modules/NetworkDoctor';
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
      await runNetworkDoctor();
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
