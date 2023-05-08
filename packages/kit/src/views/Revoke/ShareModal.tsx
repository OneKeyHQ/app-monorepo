import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import ViewShot from 'react-native-view-shot';

import {
  HStack,
  IconButton,
  Modal,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

export const ShareModal: FC = () => {
  const intl = useIntl();

  const ref = useRef<ViewShot | null>(null);
  const [index, setIndex] = useState(0);

  const shareText = useMemo(
    () =>
      [
        intl.formatMessage({ id: 'content__share_revoke_1' }),
        intl.formatMessage({ id: 'content__share_revoke_2' }),
        intl.formatMessage({ id: 'content__share_revoke_3' }),
        intl.formatMessage({ id: 'content__share_revoke_4' }),
      ][index],
    [intl, index],
  );

  const onCopy = useCallback(
    ({ close }: { close: () => void }) => {
      copyToClipboard(shareText);
      ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
      close?.();
    },
    [shareText, intl],
  );

  const onShare = useCallback(
    async ({ close }: { close: () => void }) => {
      const uri = await ref.current?.capture?.();
      if (uri) {
        const share = await getShareModule();
        const options = {
          type: 'text/plain',
          title: 'Share',
          message: shareText,
        };
        if (!share) return;
        await share
          .open(options)
          .catch((error) => {
            debugLogger.common.error('share revoke error', error);
            onCopy({ close });
          })
          .finally(() => {
            close?.();
          });
      }
    },
    [shareText, onCopy],
  );

  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__share',
      })}
      height="560px"
      hidePrimaryAction={!platformEnv.isNative}
      onPrimaryActionPress={onShare}
      onSecondaryActionPress={onCopy}
      primaryActionTranslationId="action__share"
      secondaryActionTranslationId="action__copy"
    >
      <VStack pt="6">
        <ViewShot ref={ref}>
          <Typography.DisplayLarge textAlign="center" mb="1">
            {intl.formatMessage({ id: 'title__share_with_your_friends' })}
          </Typography.DisplayLarge>
          <Typography.Body2 textAlign="center" mb="6">
            {intl.formatMessage({ id: 'title__share_with_your_friends_desc' })}
          </Typography.Body2>
          <HStack
            alignItems="center"
            borderWidth="1"
            borderRadius={12}
            borderColor="border-default"
            bg="action-secondary-default"
            p={3}
          >
            <Text flex="1">{shareText}</Text>
            <IconButton
              name="ArrowPathMini"
              type="plain"
              onPress={() => setIndex(index >= 3 ? 0 : index + 1)}
            />
          </HStack>
        </ViewShot>
      </VStack>
    </Modal>
  );
};
