import type { IKeyOfIcons, IStackProps } from '@onekeyhq/components';
import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';

export enum EUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  ready = 'ready',
}

function UpdateStatusText() {
  return (
    <XStack alignItems="center" space="$2" flexShrink={1}>
      <Icon name="DownloadOutline" color="$iconInfo" size="$4" />
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        numberOfLines={1}
      >
        Update App to 4.17 is available
      </SizableText>
    </XStack>
  );
}

const UPDATE_ACTION_TEXT = {
  [EUpdateStatus.notify]: {
    label: 'View',
  },
  [EUpdateStatus.downloading]: {
    label: 'View',
  },
  [EUpdateStatus.ready]: {
    label: 'Restart to Update',
    icon: 'RefreshCcwSolid' as IKeyOfIcons,
  },
};

function UpdateAction() {
  const { icon, label } = UPDATE_ACTION_TEXT[EUpdateStatus.ready];
  return (
    <Button size="small" icon={icon}>
      {label}
    </Button>
  );
}

const UPDATE_REMINDER_BAR_STYLE: Record<EUpdateStatus, IStackProps> = {
  [EUpdateStatus.notify]: {
    bg: '$bgSuccessSubdued',
    borderTopWidth: '$px',
    borderBottomWidth: '$px',
    borderColor: '$borderSuccessSubdued',
  },
  [EUpdateStatus.downloading]: {
    bg: '$bgSuccessSubdued',
    borderTopWidth: '$px',
    borderBottomWidth: '$px',
    borderColor: '$borderSuccessSubdued',
  },
  [EUpdateStatus.ready]: {
    bg: '$bgSuccessSubdued',
    borderTopWidth: '$px',
    borderBottomWidth: '$px',
    borderColor: '$borderSuccessSubdued',
  },
};

export function UpdateReminder() {
  const style = UPDATE_REMINDER_BAR_STYLE[EUpdateStatus.ready];
  return (
    <XStack
      px="$5"
      py="$2"
      justifyContent="space-between"
      alignItems="center"
      {...style}
    >
      <UpdateStatusText />
      <UpdateAction />
    </XStack>
  );
}
