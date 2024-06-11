import { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import type {
  IButtonProps,
  IIconProps,
  IStackProps,
} from '@onekeyhq/components';
import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { DownloadProgress } from './DownloadProgress';
import { useAppUpdateInfo } from './hooks';

function UpdateStatusText({ updateInfo }: { updateInfo: IAppUpdateInfo }) {
  const intl = useIntl();
  const buildStyles = useCallback(
    () =>
      ({
        [EAppUpdateStatus.notify]: {
          iconName: 'DownloadOutline',
          iconColor: '$iconInfo',
          renderText({
            updateInfo: appUpdateInfo,
          }: {
            updateInfo: IAppUpdateInfo;
          }) {
            return intl.formatMessage(
              { id: ETranslations.update_update_app_available },
              {
                version: appUpdateInfo.latestVersion || '',
              },
            );
          },
        },
        [EAppUpdateStatus.downloading]: {
          iconName: 'RefreshCcwSolid',
          iconColor: '$iconInfo',
          renderText: DownloadProgress,
        },
        [EAppUpdateStatus.ready]: {
          iconName: 'DownloadOutline',
          iconColor: '$iconSuccess',
          renderText({
            updateInfo: appUpdateInfo,
          }: {
            updateInfo: IAppUpdateInfo;
          }) {
            return intl.formatMessage(
              { id: ETranslations.update_app_version_ready_for_update },
              {
                version: appUpdateInfo.latestVersion || '',
              },
            );
          },
        },
        [EAppUpdateStatus.failed]: {
          iconName: 'ErrorOutline',
          iconColor: '$iconCritical',
          renderText({
            updateInfo: appUpdateInfo,
          }: {
            updateInfo: IAppUpdateInfo;
          }) {
            return appUpdateInfo.errorText || '';
          },
        },
        [EAppUpdateStatus.done]: undefined,
      } as Record<
        EAppUpdateStatus,
        | {
            iconName: IIconProps['name'];
            iconColor: IIconProps['color'];
            renderText: ({
              updateInfo,
            }: {
              updateInfo: IAppUpdateInfo;
            }) => string;
          }
        | undefined
      >),
    [intl],
  );
  const styles = buildStyles();
  const data = styles[updateInfo.status];

  const { iconName, iconColor, renderText } = data || {};
  const Component = renderText;
  return Component ? (
    <XStack alignItems="center" space="$2" flexShrink={1}>
      <Icon name={iconName} color={iconColor} size="$4" flexShrink={0} />
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        numberOfLines={1}
      >
        <Component updateInfo={updateInfo} />
      </SizableText>
    </XStack>
  ) : null;
}

function OpenOnGithub() {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    openUrlExternal('https://github.com/OneKeyHQ/app-monorepo/releases');
  }, []);
  return (
    <XStack
      space="$2"
      justifyContent="space-between"
      alignItems="center"
      cursor="pointer"
      onPress={handlePress}
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.update_download_on_github })}
      </SizableText>
      <Icon name="ArrowTopRightOutline" size="$4.5" />
    </XStack>
  );
}

function UpdateAction({
  updateInfo,
  onUpdateAction,
}: {
  updateInfo: IAppUpdateInfo;
  onUpdateAction: () => void;
}) {
  const intl = useIntl();
  const styles = useMemo(
    () =>
      ({
        [EAppUpdateStatus.notify]: {
          label: intl.formatMessage({ id: ETranslations.global_view }),
        },
        [EAppUpdateStatus.downloading]: {
          label: intl.formatMessage({ id: ETranslations.global_view }),
        },
        [EAppUpdateStatus.ready]: {
          label: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.update_install_now
              : ETranslations.update_restart_to_update,
          }),
          icon: 'RestartToUpdateCustom',
          variant: 'primary',
        },
        [EAppUpdateStatus.failed]: {
          prefixElement: <OpenOnGithub />,
          label: ETranslations.global_retry,
          variant: 'primary',
        },
        [EAppUpdateStatus.done]: undefined,
      } as Record<
        EAppUpdateStatus,
        | {
            label: string;
            icon?: IIconProps['name'];
            prefixElement?: ReactElement;
            variant?: IButtonProps['variant'];
          }
        | undefined
      >),
    [intl],
  );
  const data = styles[updateInfo.status];
  if (!data) {
    return null;
  }
  const { icon, label, variant, prefixElement } = data;
  return (
    <XStack space="$4" justifyContent="space-between" alignItems="center">
      {prefixElement}
      <Button
        size="small"
        icon={icon}
        variant={variant}
        onPress={onUpdateAction}
      >
        {label}
      </Button>
    </XStack>
  );
}

const UPDATE_REMINDER_BAR_STYLE: Record<
  EAppUpdateStatus,
  IStackProps | undefined
> = {
  [EAppUpdateStatus.notify]: {
    bg: '$bgInfoSubdued',
    borderColor: '$borderInfoSubdued',
  },
  [EAppUpdateStatus.downloading]: {
    bg: '$bgInfoSubdued',
    borderColor: '$borderInfoSubdued',
  },
  [EAppUpdateStatus.ready]: {
    bg: '$bgSuccessSubdued',
    borderColor: '$borderSuccessSubdued',
  },
  [EAppUpdateStatus.failed]: {
    bg: '$bgCriticalSubdued',
    borderColor: '$borderCriticalSubdued',
  },
  [EAppUpdateStatus.done]: undefined,
};

function BasicUpdateReminder() {
  const appUpdateInfo = useAppUpdateInfo(true);
  const { data, onUpdateAction } = appUpdateInfo;
  const style = UPDATE_REMINDER_BAR_STYLE[data.status];

  if (!appUpdateInfo.isNeedUpdate || !style) {
    return null;
  }
  return (
    <XStack
      px="$5"
      py="$2"
      justifyContent="space-between"
      alignItems="center"
      borderTopWidth="$px"
      borderBottomWidth="$px"
      $md={{
        mt: '$2',
      }}
      {...style}
    >
      <UpdateStatusText updateInfo={data} />
      <UpdateAction updateInfo={data} onUpdateAction={onUpdateAction} />
    </XStack>
  );
}

export const UpdateReminder = platformEnv.isWeb
  ? () => null
  : BasicUpdateReminder;
