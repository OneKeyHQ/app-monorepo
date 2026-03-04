import { useCallback, useEffect, useState } from 'react';

import {
  ESwitchSize,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

function SkipGPGVerificationToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void backgroundApiProxy.serviceDevSetting
      .getSkipBundleGPGVerification()
      .then(setEnabled);
  }, []);

  const handleChange = useCallback((value: boolean) => {
    setEnabled(value);
    void backgroundApiProxy.serviceDevSetting.setSkipBundleGPGVerification(
      value,
    );
  }, []);

  if (!process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION) {
    return null;
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
