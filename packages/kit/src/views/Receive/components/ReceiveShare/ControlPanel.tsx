import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReceiveTestIDs } from '../../testIDs';

interface IControlPanelProps {
  onSaveImage: () => void;
  onShareImage: () => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export function ControlPanel({
  onSaveImage,
  onShareImage,
  isLoading,
  isMobile,
}: IControlPanelProps) {
  const intl = useIntl();

  return (
    <XStack gap="$2.5" mb={isMobile ? '$4' : undefined}>
      <Button
        testID={ReceiveTestIDs.ShareSaveButton}
        flex={1}
        size="large"
        variant="secondary"
        icon="DownloadOutline"
        disabled={isLoading}
        onPress={onSaveImage}
      >
        {intl.formatMessage({ id: ETranslations.action_save })}
      </Button>
      <Button
        testID={ReceiveTestIDs.ShareMoreButton}
        flex={1}
        size="large"
        variant="secondary"
        icon="DotHorOutline"
        disabled={isLoading}
        onPress={onShareImage}
      >
        {intl.formatMessage({ id: ETranslations.global_more })}
      </Button>
    </XStack>
  );
}
