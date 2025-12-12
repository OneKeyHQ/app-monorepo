import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  BadAuthError,
  InvoiceExpiredError,
  OneKeyError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { convertHyperLiquidResponse } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { Layout } from './utils/Layout';

async function showHyperLiquidVariableErrorToast() {
  try {
    await errorToastUtils.withErrorAutoToast(async () =>
      convertHyperLiquidResponse(async () => {
        const hyperLiquidError = new Error(
          'HyperLiquid test error with BTC and ETH.',
        ) as Error & {
          response: {
            status: 'err';
            response: string;
          };
        };

        hyperLiquidError.response = {
          status: 'err',
          response: 'HyperLiquid test error with BTC and ETH.',
        };

        throw hyperLiquidError;
      }),
    );
  } catch (error) {
    console.log('HyperLiquid variable error toast demo', error);
  }
}

function error10() {
  throw new BadAuthError();
}
function error00() {
  throw new OneKeyLocalError(`原生 new Error 不显示 toast: ${Date.now()}`);
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
  // throw new OneKeyLocalError(`demoErrorInSyncMethod: ${Date.now()}`);
}

async function error20() {
  await timerUtils.wait(1000);
  throw new InvoiceExpiredError({
    autoToast: true,
  });
}

type IError21Result = {
  hello: 'world';
};
async function error21(): Promise<IError21Result> {
  throw new InvoiceExpiredError({
    autoToast: true,
  });
}

function Demo1() {
  return (
    <Stack gap="$2">
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
        异步函数显示 toast （1s 后）
      </Button>
      <Button
        onPress={async () => {
          const r: IError21Result = await error21();
          console.log(r);
        }}
      >
        异步函数显示 toast (globalListener)
      </Button>
      <Button
        onPress={async () => {
          const r: IError21Result = await errorToastUtils.withErrorAutoToast(
            () => error21(),
          );
          console.log(r);
        }}
      >
        异步函数显示 toast (withErrorAutoToast)
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoError();
          console.log(ctx);
        }}
      >
        调用 background 显示 toast
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoError2();
          console.log(ctx);
        }}
      >
        调用 background 不显示 toast2
      </Button>

      <Button
        onPress={async () => {
          try {
            const ctx = await backgroundApiProxy.serviceDemo.demoError3();
            console.log(ctx);
          } catch (error) {
            console.log('调用 background 显示 toast3', error);
            throw error;
          }
        }}
      >
        调用 background 显示 toast3
      </Button>

      <Button
        onPress={async () => {
          try {
            const ctx = await backgroundApiProxy.serviceDemo.demoError4();
            console.log(ctx);
          } catch (error) {
            console.log('调用 background 显示 toast3', error);
            throw error;
          }
        }}
      >
        调用 background 显示 toast4
      </Button>

      <Button
        onPress={async () => {
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title:
              'Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, 444444444444444444444444',
            message: '33333333-33333333-33333333-33333333',
          });
        }}
      >
        调用 appEventBus 显示 toast1
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoError5();
          console.log(ctx);
        }}
      >
        调用 background 不显示 toast5
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoErrorWithUrl();
          console.log(ctx);
        }}
      >
        调用 background 显示 url
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoError6();
          console.log(ctx);
        }}
      >
        调用 background 显示 IncorrectPassword
      </Button>
      <Button
        onPress={() => {
          void showHyperLiquidVariableErrorToast();
        }}
      >
        HyperLiquid 变量错误 toast
      </Button>
    </Stack>
  );
}

function Demo2() {
  return (
    <Stack gap="$2">
      <Button
        onPress={() => {
          // Simulate error toast with diagnostic info via EventBus
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: '[Stakefish Solana Service].getDelegation unknown error',
            requestId: '982ac81b-dacc-4d37-89f4-884dd577b23a',
            // eslint-disable-next-line spellcheck/spell-checker
            diagnosticText: `RequestId: 982ac81b-dacc-4d37-89f4-884dd577b23a
Error Code: 500
Message: [Stakefish Solana Service].getDelegation unknown error
Timestamp: ${new Date().toISOString()}`,
          });
        }}
      >
        Error with Contact + Copy buttons
      </Button>
      <Button
        onPress={() => {
          // Simulate network error
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: 'Network request failed',
            errorCode: 500,
            requestId: 'req-123-456-789',
            diagnosticText: `RequestId: req-123-456-789
Error Code: 500
Message: Network request failed
Timestamp: ${new Date().toISOString()}`,
          });
        }}
      >
        Network Error (500)
      </Button>
      <Button
        onPress={() => {
          // Simulate service unavailable error
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: 'Service temporarily unavailable. Please try again later.',
            errorCode: 503,
            requestId: 'svc-unavailable-001',
            diagnosticText: `RequestId: svc-unavailable-001
Error Code: 503
Message: Service temporarily unavailable. Please try again later.
Timestamp: ${new Date().toISOString()}`,
          });
        }}
      >
        Service Unavailable (503)
      </Button>
      <Button
        onPress={() => {
          // Error without diagnosticText - should not show action buttons
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: 'Simple error without diagnostic info',
          });
        }}
      >
        Error without Diagnostic Info
      </Button>
      <Button
        onPress={() => {
          // Error with very long title and diagnostic info
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title:
              'Transaction failed due to insufficient gas fee. Please increase the gas limit and try again.',
            errorCode: 400,
            requestId: 'tx-gas-error-001',
            diagnosticText: `RequestId: tx-gas-error-001
Error Code: 400
Message: Transaction failed due to insufficient gas fee. Please increase the gas limit and try again.
Network: Ethereum Mainnet
Gas Limit: 21000
Gas Price: 50 Gwei
Timestamp: ${new Date().toISOString()}`,
          });
        }}
      >
        Long Error Message with Full Diagnostic
      </Button>
    </Stack>
  );
}

const ErrorToastGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="ErrorToast"
    elements={[
      {
        title: 'ErrorToast - Legacy Tests',
        element: (
          <Stack gap="$1">
            <Demo1 />
          </Stack>
        ),
      },
      {
        title: 'ErrorToast - New UX (Step 2)',
        element: (
          <Stack gap="$1">
            <Demo2 />
          </Stack>
        ),
      },
    ]}
  />
);

export default ErrorToastGallery;
