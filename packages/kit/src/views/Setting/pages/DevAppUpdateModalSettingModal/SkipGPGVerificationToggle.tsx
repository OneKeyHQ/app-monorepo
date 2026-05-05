import { useCallback, useEffect, useState } from 'react';

import {
  ESwitchSize,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

function SkipGPGVerificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [isSkipGpgVerificationAllowed, setIsSkipGpgVerificationAllowed] =
    useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      backgroundApiProxy.serviceDevSetting.getSkipBundleGPGVerification(),
      BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false),
    ]).then(([skipEnabled, skipAllowed]) => {
      if (!isMounted) {
        return;
      }
      setEnabled(skipEnabled);
      setIsSkipGpgVerificationAllowed(Boolean(skipAllowed));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = useCallback((value: boolean) => {
    setEnabled(value);
    void backgroundApiProxy.serviceDevSetting.setSkipBundleGPGVerification(
      value,
    );
  }, []);

  if (isSkipGpgVerificationAllowed === null) {
    return (
      <YStack>
        <SizableText size="$bodyLgMedium" color="$textSubdued">
          Skip GPG / ASC Verification
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Checking support...
        </SizableText>
      </YStack>
    );
  }

  if (!isSkipGpgVerificationAllowed) {
    return (
      <YStack>
        <SizableText size="$bodyLgMedium" color="$textCaution">
          Skip GPG / ASC Verification
        </SizableText>
        <SizableText size="$bodySm" color="$textCaution">
          Not available on this build.
        </SizableText>
      </YStack>
    );
  }

  return (
    <XStack alignItems="center" justifyContent="space-between">
      <YStack flex={1} mr="$2">
        <SizableText size="$bodyLgMedium" color="$textCritical">
          Skip GPG / ASC Verification
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Skip GPG signature verification in bundle update and ASC verification
          in app update (requires dev mode)
        </SizableText>
      </YStack>
      <Switch
        size={ESwitchSize.small}
        value={enabled}
        onChange={handleChange}
      />
    </XStack>
  );
}

export default SkipGPGVerificationToggle;
