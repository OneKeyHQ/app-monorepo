import type { FC, ReactNode } from 'react';

import Box from '../Box';

interface InAppNotificationProps {
  title: string;
  subtitle?: string;
  cover?: string;
  rightContent?: () => ReactNode;
  actionText?: string;
  onActionPress?: () => void;
  linkedRoute: string;
  linkedRouteParams?: Record<string, unknown>;
  footer?: string;
}
const InAppNotification: FC<InAppNotificationProps> = () => {
  const a = 1;
  return <Box />;
};

export default InAppNotification;
