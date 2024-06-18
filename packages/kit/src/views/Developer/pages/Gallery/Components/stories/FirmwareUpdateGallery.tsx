import { useState } from 'react';

import {
  Button,
  Dialog,
  Form,
  Select,
  SizableText,
  Stack,
  Switch,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { FirmwareChangeLogView } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareChangeLogView';
import { FirmwareCheckingLoading } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareCheckingLoading';
import { FirmwareInstallingViewBase } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareInstallingView';
import { FirmwareLatestVersionInstalled } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareLatestVersionInstalled';
import { FirmwareUpdateCheckList } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareUpdateCheckList';
import {
  EnterBootModeGuide,
  useFirmwareUpdateErrors,
} from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareUpdateErrors';
import { FirmwareUpdateProgressBarView } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareUpdateProgressBar';
import { FirmwareUpdateWarningMessage } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/FirmwareUpdateWarningMessage';
import { FirmwareUpdateReminderAlert } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import {
  EFirmwareAuthenticationDialogContentType,
  EnumBasicDialogContentContainer,
} from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/firewareUpdateFixtures';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdatesDetectStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import * as AllErrors from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import { Layout } from './utils/Layout';

function ForceOpenHomeDeviceUpdateFirmwareModal() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();
  return (
    <Button
      onPress={async () => {
        actions.openChangeLogModal({ connectId });
      }}
    >
      NormalModeUpdate
    </Button>
  );
}

function ResetDetectTimeCheck() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  return (
    <Button
      onPress={() => {
        if (!connectId) {
          return;
        }
        void backgroundApiProxy.serviceFirmwareUpdate.resetShouldDetectTimeCheck(
          {
            connectId,
          },
        );
      }}
    >
      ResetDetectTimeCheck
    </Button>
  );
}

function BootloaderModeUpdateButton() {
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const actions = useFirmwareUpdateActions();
  return (
    <Button
      onPress={() => {
        actions.showBootloaderMode({ connectId: undefined });
        console.log({
          retryInfo,
        });
      }}
    >
      BootloaderModeUpdate
    </Button>
  );
}

function ClearUpdateInfoDetectCacheButton() {
  const [, setDetectStatus] = useFirmwareUpdatesDetectStatusAtom();
  return (
    <Button
      onPress={() => {
        setDetectStatus(undefined);
      }}
    >
      ClearUpdateInfoDetectCache
    </Button>
  );
}

export function FirmwareUpdateGalleryDemo() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <Stack space="$2">
        <>
          <ForceOpenHomeDeviceUpdateFirmwareModal />
          <BootloaderModeUpdateButton />
          <ClearUpdateInfoDetectCacheButton />
          <ResetDetectTimeCheck />
        </>
      </Stack>
    </AccountSelectorProviderMirror>
  );
}

function FirmwareUpdateErrorDemo({
  error,
  onRetry,
  result,
}: {
  onRetry?: () => void;
  error: IOneKeyError;
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onRetryHandler, content, detail, retryText } =
    useFirmwareUpdateErrors({
      error,
      onRetry,
      result,
      lastFirmwareTipMessage: undefined,
    });
  return (
    <>
      {content}
      {detail}
    </>
  );
}

function StaticUIDialog() {
  const form = useForm({
    defaultValues: {
      contentType: EFirmwareAuthenticationDialogContentType.default,
    },
  });
  return (
    <Form form={form}>
      <Form.Field name="contentType" label="contentType">
        <Select
          title=""
          items={Object.keys(EFirmwareAuthenticationDialogContentType).map(
            (i) => ({ label: i, value: i }),
          )}
        />
      </Form.Field>

      <Button
        onPress={() => {
          Dialog.show({
            showFooter: false,
            renderContent: (
              <EnumBasicDialogContentContainer
                {...form.getValues()}
                errorObj={{
                  code: 800,
                }}
                onActionPress={() => {
                  alert('onActionPress');
                }}
                onContinuePress={() => {
                  alert('onContinuePress');
                }}
              />
            ),
          });
        }}
      >
        FirmwareVerify UI Dialog
      </Button>
    </Form>
  );
}

function FirmwareUpdateGalleryStaticUI() {
  const actions = useFirmwareUpdateActions();
  return (
    <Stack mt="$8">
      <Stack my="$8">
        <SizableText size="$heading5xl">* 首页更新提示</SizableText>
        <FirmwareUpdateReminderAlert message="Firmware 3.6.0 is available" />
        <Button
          onPress={() => {
            actions.showBootloaderMode({ connectId: undefined });
          }}
        >
          Bootloader 模式更新提示
        </Button>
        <Button
          onPress={() => {
            actions.showForceUpdate({ connectId: undefined });
          }}
        >
          强更提示
        </Button>
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 更新检测中</SizableText>
        <FirmwareCheckingLoading connectId={undefined} />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 更新日志（有更新）</SizableText>
        <FirmwareChangeLogView
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
        />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 已经是最新固件（无更新）</SizableText>
        <FirmwareLatestVersionInstalled />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 升级前检查项</SizableText>
        <FirmwareUpdateCheckList
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
        />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 升级错误</SizableText>
        <SizableText size="$heading2xl">
          ** 通用错误（直接修改 Error 类型的 defaultMessage）
        </SizableText>
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.FirmwareUpdateLimitOneDevice()}
        />
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.FirmwareUpdateBatteryTooLow()}
        />

        <SizableText size="$heading2xl">** 需要手动进入 boot 模式</SizableText>
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.FirmwareUpdateManuallyEnterBoot()}
        />

        <SizableText size="$heading2xl">
          ** 手动进入 boot 模式(mini)
        </SizableText>
        <EnterBootModeGuide deviceType="mini" />

        <SizableText size="$heading2xl">
          ** 手动进入 boot 模式(classic)
        </SizableText>
        <EnterBootModeGuide deviceType="classic" />

        <SizableText size="$heading2xl">
          ** 需要安装或检查 bridge 状态
        </SizableText>
        <SizableText>TODO</SizableText>

        <SizableText size="$heading2xl">** 需要手动升级 bridge</SizableText>
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.NeedOneKeyBridgeUpgrade()}
        />
        <SizableText size="$heading2xl">** 需要在网页端升级</SizableText>
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.NeedFirmwareUpgradeFromWeb()}
        />
        <SizableText size="$heading2xl">** 需要手动升级全量资源</SizableText>
        <FirmwareUpdateErrorDemo
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          error={new AllErrors.UseDesktopToUpdateFirmware()}
        />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading5xl">* 安装进度</SizableText>

        <SizableText size="$heading2xl">** 安装提醒</SizableText>
        <FirmwareUpdateWarningMessage />

        <SizableText size="$heading2xl">** 安装中</SizableText>

        <FirmwareUpdateProgressBarView
          currentStep={undefined}
          totalStep={undefined}
          title="Preparing..."
          progress={12}
          desc="Checking device..."
          fromVersion=""
          toVersion=""
        />

        <FirmwareUpdateProgressBarView
          currentStep={1}
          totalStep={1}
          title="Preparing...(Only One Step, no step text bar is displayed)"
          progress={12}
          desc="Checking device..."
          fromVersion=""
          toVersion=""
        />

        <FirmwareUpdateProgressBarView
          currentStep={1}
          totalStep={3}
          title="Updating firmware..."
          progress={20}
          desc="Downloading..."
          fromVersion={undefined}
          toVersion="1.0.1"
        />

        <FirmwareUpdateProgressBarView
          currentStep={2}
          totalStep={3}
          title="Updating bluetooth..."
          progress={50}
          desc="Transferring..."
          fromVersion="1.0.0"
          toVersion="1.0.1"
        />

        <SizableText size="$heading2xl">
          ** 安装出错重试(和前面的 Error 组件共享 UI)
        </SizableText>
        <FirmwareInstallingViewBase
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          tipMessage={EFirmwareUpdateTipMessages.FirmwareEraseSuccess}
          retryInfo={{
            id: 0,
            error: new AllErrors.FirmwareUpdateManuallyEnterBoot(),
          }}
        />

        <SizableText size="$heading2xl">** 安装完成</SizableText>
        <FirmwareInstallingViewBase
          result={FIRMWARE_UPDATE_UPDATE_INFO_SAMPLE as any}
          isDone
          tipMessage={EFirmwareUpdateTipMessages.AutoRebootToBootloader}
          retryInfo={undefined}
        />
      </Stack>

      <Stack my="$8">
        <SizableText size="$heading2xl">* StaticUIDialog</SizableText>
        <StaticUIDialog />
      </Stack>
    </Stack>
  );
}

const FirmwareUpdateGallery = () => (
  <Layout
    description="--"
    suggestions={['--']}
    boundaryConditions={['--']}
    elements={[
      {
        title: '--',
        element: (
          <Stack space="$1">
            <FirmwareUpdateGalleryDemo />
            <FirmwareUpdateGalleryStaticUI />
          </Stack>
        ),
      },
    ]}
  />
);

export default FirmwareUpdateGallery;
