import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import {
  BadAuthError,
  InvoiceExpiredError,
  OneKeyError,
} from '@onekeyhq/shared/src/errors';

import { Layout } from './utils/Layout';

function error10() {
  throw new BadAuthError();
}
function error00() {
  throw new Error(`原生 new Error 不显示 toast: ${Date.now()}`);
}
function error11() {
  throw new BadAuthError({
    autoToast: true,
  });
}
function error13() {
  throw new OneKeyError({
    autoToast: true,
    message: '使用基类 new OneKeyError + autoToast 显示 toast',
  });
}
function error12() {
  throw new BadAuthError({
    autoToast: true,
    message: '自定义 Error 类，显式传入自定义 message，不再使用内置 i18n',
  });
  // throw new Error(`demoErrorInSyncMethod: ${Date.now()}`);
}

async function error20() {
  await wait(1000);
  throw new InvoiceExpiredError({
    autoToast: true,
  });
}

function Demo1() {
  return (
    <Stack space="$2">
      <Button
        onPress={() => {
          error00();
        }}
      >
        不显示 toast1
      </Button>
      <Button
        onPress={() => {
          error10();
        }}
      >
        不显示 toast2
      </Button>
      <Button
        onPress={() => {
          error13();
        }}
      >
        显示 toast
      </Button>
      <Button
        onPress={() => {
          error11();
        }}
      >
        显示 toast2
      </Button>
      <Button
        onPress={() => {
          error12();
        }}
      >
        显示 toast 自定义 message
      </Button>
      <Button
        onPress={async () => {
          await error20();
        }}
      >
        异步函数显示 toast
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoError();
          console.log(ctx);
        }}
      >
        调用 background 显示 toast
      </Button>
    </Stack>
  );
}

const ErrorToastGallery = () => (
  <Layout
    description="ErrorToast"
    suggestions={['ErrorToast']}
    boundaryConditions={['ErrorToast']}
    elements={[
      {
        title: 'ErrorToast',
        element: (
          <Stack space="$1">
            <Demo1 />
          </Stack>
        ),
      },
    ]}
  />
);

export default ErrorToastGallery;
