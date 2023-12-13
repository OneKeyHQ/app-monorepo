import { useCallback, useState } from 'react';

import { Button, Dialog, Portal, ScrollView } from '@onekeyhq/components';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';

export function AccountSelectorTrigger({ num }: { num: number }) {
  const contextData = useAccountSelectorContextData();
  const { config } = contextData;
  const [ready, setReady] = useState(false);
  const title = `${config?.sceneName || ''} 账户选择器 🔗  ${num}`;
  const showAccountSelector = useCallback(() => {
    Dialog.show({
      title,
      estimatedContentHeight: 490,
      onClose() {
        setReady(false);
      },
      //
      renderContent: (
        <Portal.Container name={Portal.Constant.ACCOUNT_SELECTOR} />
      ),
      showFooter: false,
    });
    setReady(true);
  }, [title]);
  return (
    <>
      <Button onPress={showAccountSelector}>{title}</Button>
      {ready ? (
        <Portal.Body container={Portal.Constant.ACCOUNT_SELECTOR}>
          {/* pass down context data with store */}
          <AccountSelectorProviderMirror config={checkIsDefined(config)}>
            <ScrollView h="$100">
              <AccountSelectorDialog num={num} />
            </ScrollView>
          </AccountSelectorProviderMirror>
        </Portal.Body>
      ) : null}
    </>
  );
}
