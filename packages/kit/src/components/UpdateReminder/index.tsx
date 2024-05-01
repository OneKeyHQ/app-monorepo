import { useCallback } from 'react';
import type { ReactElement } from 'react';

import type {
  IButtonProps,
  IIconProps,
  IStackProps,
} from '@onekeyhq/components';
import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { DownloadProgress } from './DownloadProgress';
import { useAppUpdateInfo } from './hooks';

const UPDATE_STATUS_TEXT_STYLE: Record<
  EAppUpdateStatus,
  | {
      iconName: IIconProps['name'];
      iconColor: IIconProps['color'];
      renderText: (appUpdateInfo: IAppUpdateInfo) => string;
    }
  | undefined
> = {
  [EAppUpdateStatus.notify]: {
    iconName: 'DownloadOutline',
    iconColor: '$iconInfo',
    renderText(appUpdateInfo) {
      return `Update App to ${appUpdateInfo.latestVersion || ''} is available`;
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
    renderText(appUpdateInfo) {
      return `App ${appUpdateInfo.latestVersion || ''} Ready for Update`;
    },
  },
  [EAppUpdateStatus.failed]: {
    iconName: 'ErrorOutline',
    iconColor: '$iconCritical',
    renderText(appUpdateInfo) {
      return appUpdateInfo.errorText || '';
    },
  },
  [EAppUpdateStatus.done]: undefined,
};

function UpdateStatusText({ updateInfo }: { updateInfo: IAppUpdateInfo }) {
  const data = UPDATE_STATUS_TEXT_STYLE[updateInfo.status];

  if (!data) {
    return null;
  }
  const { iconName, iconColor, renderText } = data;
  return (
    <XStack alignItems="center" space="$2" flexShrink={1}>
      <Icon name={iconName} color={iconColor} size="$4" flexShrink={0} />
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        numberOfLines={1}
      >
        {renderText(updateInfo)}
      </SizableText>
    </XStack>
  );
}

function OpenOnGithub() {
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
        Download on Github
      </SizableText>
      <Icon name="ArrowTopRightOutline" size="$4.5" />
    </XStack>
  );
}

const UPDATE_ACTION_STYLE: Record<
  EAppUpdateStatus,
  | {
      label: string;
      icon?: IIconProps['name'];
      prefixElement?: ReactElement;
      variant?: IButtonProps['variant'];
    }
  | undefined
> = {
  [EAppUpdateStatus.notify]: {
    label: 'View',
  },
  [EAppUpdateStatus.downloading]: {
    label: 'View',
  },
  [EAppUpdateStatus.ready]: {
    label: platformEnv.isNativeAndroid ? 'Install Now' : 'Restart to Update',
    icon: 'RestartToUpdateCustom',
    variant: 'primary',
  },
  [EAppUpdateStatus.failed]: {
    prefixElement: <OpenOnGithub />,
    label: 'Retry',
    variant: 'primary',
  },
  [EAppUpdateStatus.done]: undefined,
};

function UpdateAction({
  updateInfo,
  onUpdateAction,
}: {
  updateInfo: IAppUpdateInfo;
  onUpdateAction: () => void;
}) {
  const data = UPDATE_ACTION_STYLE[updateInfo.status];
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
  if (!appUpdateInfo.isNeedUpdate) {
    return null;
  }
  const { data, onUpdateAction } = appUpdateInfo;
  const style = UPDATE_REMINDER_BAR_STYLE[data.status];

  if (!style) {
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
