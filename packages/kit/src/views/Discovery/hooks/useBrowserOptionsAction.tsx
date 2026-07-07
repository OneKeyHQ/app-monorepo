import {
  createRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import { Dialog, Input, Toast } from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IRenameTabDialogContentRef = {
  getValue: () => string;
};

const RENAME_TAB_DIALOG_ESTIMATED_CONTENT_HEIGHT = 44;

const RenameTabDialogContent = forwardRef<
  IRenameTabDialogContentRef,
  {
    initialValue: string;
    placeholder?: string;
  }
>(function RenameTabDialogContent({ initialValue, placeholder }, ref) {
  const [value, setValue] = useState(initialValue);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => value,
    }),
    [value],
  );

  return (
    <Input
      testID="discovery-handle-rename-tab-input"
      autoFocus
      flex={1}
      placeholder={placeholder}
      clearButtonMode="always"
      value={value}
      onChangeText={setValue}
    />
  );
});

function useBrowserOptionsAction() {
  const handleShareUrl = useCallback((url: string) => {
    if (!url) {
      throw new OneKeyLocalError('url is required');
    }
    setTimeout(() => {
      void Share.share(
        platformEnv.isNativeIOS
          ? {
              url,
            }
          : {
              message: url,
            },
      );
    }, 300);
  }, []);

  const intl = useIntl();
  const { setWebTabData, setTabs } = useBrowserTabActions().current;

  const handleRenameTab = useCallback(
    (item: IWebTab) =>
      new Promise((resolve) => {
        const contentRef = createRef<IRenameTabDialogContentRef>();
        const initialName =
          (item?.customTitle?.length ?? 0) > 0
            ? (item?.customTitle ?? '')
            : (item?.title ?? '');
        Dialog.confirm({
          title: intl.formatMessage({
            id: ETranslations.explore_rename,
          }),
          renderContent: (
            <RenameTabDialogContent
              ref={contentRef}
              initialValue={initialName}
              placeholder={item.title ?? ''}
            />
          ),
          estimatedContentHeight: RENAME_TAB_DIALOG_ESTIMATED_CONTENT_HEIGHT,
          onConfirm: () => {
            setWebTabData({
              ...item,
              customTitle: contentRef.current?.getValue(),
            });
            setTabs();
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.global_success,
              }),
            });
            resolve(true);
          },
        });
      }),
    [intl, setWebTabData, setTabs],
  );

  return useMemo(
    () => ({ handleShareUrl, handleRenameTab }),
    [handleShareUrl, handleRenameTab],
  );
}

export default useBrowserOptionsAction;
