import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import { Dialog, Input, Toast } from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useBrowserOptionsAction() {
  const handleShareUrl = useCallback((url: string) => {
    if (!url) {
      throw new Error('url is required');
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
        Dialog.confirm({
          title: intl.formatMessage({
            id: ETranslations.explore_rename,
          }),
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: { name: item.title },
              }}
            >
              <Dialog.FormField
                name="name"
                rules={{
                  required: {
                    value: true,
                    message: intl.formatMessage({
                      id: ETranslations.explore_enter_bookmark_name,
                    }),
                  },
                  minLength: {
                    value: 1,
                    message: intl.formatMessage({
                      id: ETranslations.explore_bookmark_at_least,
                    }),
                  },
                  maxLength: {
                    value: 24,
                    message: intl.formatMessage({
                      id: ETranslations.explore_bookmark_exceed,
                    }),
                  },
                }}
              >
                <Input autoFocus flex={1} />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          onConfirm: (dialogInstance) => {
            const form = dialogInstance.getForm()?.getValues();
            if (form?.name) {
              setWebTabData({ ...item, title: form.name });
              setTabs();
            }
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
