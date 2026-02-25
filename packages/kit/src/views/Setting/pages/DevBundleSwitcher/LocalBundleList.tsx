import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Divider,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ILocalBundle = { appVersion: string; bundleVersion: string };

function LocalBundleItem({
  bundle,
  isCurrent,
  onSwitch,
  isSwitching,
}: {
  bundle: ILocalBundle;
  isCurrent: boolean;
  onSwitch: (bundle: ILocalBundle) => void;
  isSwitching: boolean;
}) {
  return (
    <YStack
      p="$3"
      borderRadius="$3"
      bg="$bgSubdued"
      gap="$2"
      position="relative"
    >
      <SizableText size="$bodyLgMedium">
        {`${bundle.appVersion} - bundle ${bundle.bundleVersion}`}
      </SizableText>
      {!isCurrent ? (
        <Button
          variant="primary"
          size="small"
          disabled={isSwitching}
          onPress={() => onSwitch(bundle)}
        >
          {isSwitching ? 'Switching...' : 'Switch'}
        </Button>
      ) : null}
      {isCurrent ? (
        <Stack position="absolute" bottom="$2" right="$2">
          <Icon name="CheckRadioSolid" size="$8" color="$iconSuccess" />
        </Stack>
      ) : null}
      {isSwitching ? (
        <Stack position="absolute" bottom="$2" right="$2">
          <Icon name="RefreshCwSolid" size="$8" color="$iconSubdued" />
        </Stack>
      ) : null}
    </YStack>
  );
}

export default function SettingDevLocalBundleList() {
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<ILocalBundle[]>([]);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentAppVersion = String(platformEnv.version);

  useEffect(() => {
    void (async () => {
      try {
        const localBundles = await BundleUpdate.listLocalBundles();
        setBundles(localBundles);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSwitch = useCallback(
    async (bundle: ILocalBundle) => {
      const key = `${bundle.appVersion}-${bundle.bundleVersion}`;
      setSwitchingTo(key);
      setError('');
      try {
        await BundleUpdate.verifyExtractedBundle(
          bundle.appVersion,
          bundle.bundleVersion,
        );
        await BundleUpdate.switchBundle({
          ...bundle,
          signature: 'dev-local-switch',
        });
      } catch (e) {
        setError((e as Error)?.message || 'Switch failed');
        setSwitchingTo(null);
      }
    },
    [],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Local Bundles" />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack p="$4" gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {`${bundles.length} bundle(s) on device`}
            </SizableText>
            {error ? (
              <SizableText size="$bodySm" color="$textCritical">
                {`Error: ${error}`}
              </SizableText>
            ) : null}
            <Divider />
            {bundles.map((bundle) => {
              const key = `${bundle.appVersion}-${bundle.bundleVersion}`;
              const isCurrent =
                bundle.appVersion === currentAppVersion &&
                bundle.bundleVersion === currentBundleVersion;
              return (
                <LocalBundleItem
                  key={key}
                  bundle={bundle}
                  isCurrent={isCurrent}
                  onSwitch={handleSwitch}
                  isSwitching={switchingTo === key}
                />
              );
            })}
            {bundles.length === 0 ? (
              <SizableText color="$textSubdued" textAlign="center">
                No bundles found on device
              </SizableText>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
