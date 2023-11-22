import { Suspense, memo } from 'react';

import {
  Button,
  Dialog,
  Page,
  Spinner,
  Text,
  Toast,
  XStack,
} from '@onekeyhq/components';
import {
  EPasswordResStatus,
  type IPasswordRes,
} from '@onekeyhq/kit-bg/src/services/ServicePassword';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import BiologyAuthSwitchContainer from '../../components/BiologyAuthComponent/container/BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from '../../components/BiologyAuthComponent/container/WebAuthSwitchContainer';
import PasswordSetupContainer from '../../components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '../../components/Password/container/PasswordUpdateContainer';

const Swap = () => {
  console.log('swap');

  return (
    <Page>
      <Page.Body space="$4">
        <Text>Swap</Text>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
