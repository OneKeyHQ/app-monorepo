import { useEffect } from 'react';

import { Dialog, YStack } from '@onekeyhq/components';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../components/ProtocolDetails/EarnText';

interface IUseUnsupportedProtocolMonitorProps {
  detailInfo?: IStakeEarnDetail;
  appNavigation: ReturnType<typeof useAppNavigation>;
  setKeepSkeletonVisible: (visible: boolean) => void;
}

export function useUnsupportedProtocol({
  detailInfo,
  appNavigation,
  setKeepSkeletonVisible,
}: IUseUnsupportedProtocolMonitorProps) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (detailInfo?.statement) {
      // Keep skeleton visible for better UX
      setKeepSkeletonVisible(true);

      // Exit current modal and show unsupported dialog after 500ms
      timer = setTimeout(() => {
        setKeepSkeletonVisible(false);
        appNavigation.pop();
        const statement = detailInfo.statement;

        if (statement) {
          const linkButton = statement.buttons?.find(
            (btn) => btn.type === 'link',
          );
          const closeButton = statement.buttons?.find(
            (btn) => btn.type === 'close',
          );

          Dialog.show({
            icon: statement.icon?.icon,
            title: statement.title?.text,
            showFooter: !!linkButton,
            renderContent: statement.items?.length ? (
              <YStack gap="$2">
                {statement.items.map((item, index) => (
                  <EarnText
                    key={index}
                    text={item.title}
                    size="$bodyMd"
                    color="$text"
                  />
                ))}
              </YStack>
            ) : undefined,
            onConfirm: linkButton
              ? () => {
                  if (linkButton.data?.link) {
                    void openUrlExternal(linkButton.data.link);
                  }
                }
              : undefined,
            onConfirmText: linkButton?.text?.text,
            confirmButtonProps: {
              iconAfter: linkButton?.data?.icon?.icon,
            },
            onCancelText: closeButton?.text?.text,
          });
        }
      }, 500);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        setKeepSkeletonVisible(false);
      }
    };
  }, [detailInfo, appNavigation, setKeepSkeletonVisible]);
}
