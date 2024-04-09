import type { ReactElement } from 'react';

import type {
  IButtonProps,
  IIconProps,
  IStackProps,
} from '@onekeyhq/components';
import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useFetchAppUpdateInfo } from './hooks';

export enum EUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  ready = 'ready',
  failed = 'failed',
}

const UPDATE_STATUS_TEXT_STYLE: Record<
  EUpdateStatus,
  {
    iconName: IIconProps['name'];
    iconColor: IIconProps['color'];
    renderText: (text: string) => string;
  }
> = {
  [EUpdateStatus.notify]: {
    iconName: 'DownloadOutline',
    iconColor: '$iconInfo',
    renderText(version: string) {
      return `Update App to ${version} is available`;
    },
  },
  [EUpdateStatus.downloading]: {
    iconName: 'RefreshCcwSolid',
    iconColor: '$iconInfo',
    renderText(percents: string) {
      return `Downloading Package... ${percents}%`;
    },
  },
  [EUpdateStatus.ready]: {
    iconName: 'DownloadOutline',
    iconColor: '$iconSuccess',
    renderText(version: string) {
      return `App ${version} Ready for Update`;
    },
  },
  [EUpdateStatus.failed]: {
    iconName: 'ErrorOutline',
    iconColor: '$iconCritical',
    renderText(errorMessage: string) {
      return `Update App to ${errorMessage} is available`;
    },
  },
};

const testStatus = EUpdateStatus.notify;
function UpdateStatusText() {
  const { iconName, iconColor, renderText } =
    UPDATE_STATUS_TEXT_STYLE[testStatus];
  return (
    <XStack alignItems="center" space="$2" flexShrink={1}>
      <Icon name={iconName} color={iconColor} size="$4" flexShrink={0} />
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        numberOfLines={1}
      >
        {renderText('4.1')}
      </SizableText>
    </XStack>
  );
}

const UPDATE_ACTION_STYLE: Record<
  EUpdateStatus,
  {
    label: string;
    icon?: IIconProps['name'];
    prefixElement?: ReactElement;
    variant?: IButtonProps['variant'];
  }
> = {
  [EUpdateStatus.notify]: {
    label: 'View',
  },
  [EUpdateStatus.downloading]: {
    label: 'View',
  },
  [EUpdateStatus.ready]: {
    label: 'Restart to Update',
    icon: 'RefreshCcwSolid',
    variant: 'primary',
  },
  [EUpdateStatus.failed]: {
    prefixElement: (
      <XStack space="$2" justifyContent="space-between" alignItems="center">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          Download on Github
        </SizableText>
        <Icon name="ArrowTopRightOutline" size="$4.5" />
      </XStack>
    ),
    label: 'Retry',
    variant: 'primary',
  },
};

function UpdateAction() {
  const { icon, label, variant, prefixElement } =
    UPDATE_ACTION_STYLE[testStatus];
  return (
    <XStack space="$4" justifyContent="space-between" alignItems="center">
      {prefixElement}
      <Button size="small" icon={icon} variant={variant}>
        {label}
      </Button>
    </XStack>
  );
}

const UPDATE_REMINDER_BAR_STYLE: Record<EUpdateStatus, IStackProps> = {
  [EUpdateStatus.notify]: {
    bg: '$bgInfoSubdued',
    borderColor: '$borderInfoSubdued',
  },
  [EUpdateStatus.downloading]: {
    bg: '$bgInfoSubdued',
    borderColor: '$borderInfoSubdued',
  },
  [EUpdateStatus.ready]: {
    bg: '$bgSuccessSubdued',
    borderColor: '$borderCriticalSubdued',
  },
  [EUpdateStatus.failed]: {
    bg: '$bgCriticalSubdued',
    borderColor: '$borderSuccessSubdued',
  },
};

function BasicUpdateReminder() {
  const style = UPDATE_REMINDER_BAR_STYLE[testStatus];
  const appUpdateInfo = useFetchAppUpdateInfo();
  console.log(appUpdateInfo);
  return (
    <XStack
      px="$5"
      py="$2"
      justifyContent="space-between"
      alignItems="center"
      borderTopWidth="$px"
      borderBottomWidth="$px"
      {...style}
    >
      <UpdateStatusText />
      <UpdateAction />
    </XStack>
  );
}

export const UpdateReminder = platformEnv.isWeb
  ? () => null
  : BasicUpdateReminder;
