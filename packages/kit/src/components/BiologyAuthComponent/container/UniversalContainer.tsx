import { Stack, Text, XStack } from '@onekeyhq/components';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import BiologyAuthSwitchContainer from './BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from './WebAuthSwitchContainer';

export const UniversalContainer = () => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  if (biologyAuthIsSupport) {
    return <BiologyAuthSwitchContainer />;
  }
  if (webAuthIsSupport) {
    return <WebAuthSwitchContainer />;
  }
  return null;
};

export const LabelUniversalContainer = () => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  return biologyAuthIsSupport || webAuthIsSupport ? (
    <XStack justifyContent="space-between" alignItems="center">
      <Text variant="bodyMdMedium">Authentication with FaceID</Text>
      <Stack>
        <UniversalContainer />
      </Stack>
    </XStack>
  ) : null;
};
