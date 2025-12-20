import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import type { IBadgeProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

interface IBasicAddressBadgeProps {
  title: string;
  icon?: IKeyOfIcons;
  content?: ReactElement | string;
  popoverTitle?: string;
  badgeType: IBadgeProps['badgeType'];
}

function BasicAddressBadge({
  title,
  icon,
  content,
  badgeType,
  popoverTitle,
}: IBasicAddressBadgeProps) {
  const badgeElement = useMemo(
    () => (
      <Badge badgeType={badgeType} badgeSize="sm">
        <XStack gap="$1" alignItems="center" userSelect="none">
          {icon ? <Icon name={icon} size="$4" /> : null}
          <Badge.Text> {title}</Badge.Text>
        </XStack>
      </Badge>
    ),
    [badgeType, icon, title],
  );
  return content ? (
    <Popover
      placement="bottom-start"
      title={popoverTitle || title}
      renderTrigger={badgeElement}
      renderContent={() => (
        <Stack gap="$4" p="$4">
          <SizableText size="$bodyMd">{content}</SizableText>
        </Stack>
      )}
    />
  ) : (
    badgeElement
  );
}

export const AddressBadge = memo(BasicAddressBadge);
