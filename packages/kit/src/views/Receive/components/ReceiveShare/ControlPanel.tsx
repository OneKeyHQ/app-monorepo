import { useIntl } from 'react-intl';

import { Button, XStack, useMedia } from '@onekeyhq/components';
import { canShareImageToSystem } from '@onekeyhq/kit/src/utils/shareUtils';
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
  const media = useMedia();
  const buttonSize = media.gtMd ? 'medium' : 'large';
  // without a real system share surface the button would just duplicate
  // "save", so render "save" alone (OK-58192)
  const showShareEntry = canShareImageToSystem();

  return (
    <XStack gap="$2.5" mb={isMobile ? '$4' : undefined}>
      <Button
        testID={ReceiveTestIDs.ShareSaveButton}
        flex={1}
        size={buttonSize}
        variant="secondary"
        icon="DownloadOutline"
        disabled={isLoading}
        onPress={onSaveImage}
      >
        {intl.formatMessage({ id: ETranslations.action_save })}
      </Button>
      {showShareEntry ? (
        <Button
          testID={ReceiveTestIDs.ShareMoreButton}
          flex={1}
          size={buttonSize}
          variant="secondary"
          icon="DotHorOutline"
          disabled={isLoading}
          onPress={onShareImage}
        >
          {intl.formatMessage({ id: ETranslations.global_more })}
        </Button>
      ) : null}
    </XStack>
  );
}
