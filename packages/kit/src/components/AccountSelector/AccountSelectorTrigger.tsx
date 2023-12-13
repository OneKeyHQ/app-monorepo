import { useCallback } from 'react';

import { Button, Dialog, ScrollView } from '@onekeyhq/components';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';

function Content({ num }: { num: number }) {
  return (
    <ScrollView h="$100">
      <AccountSelectorDialog num={num} />
    </ScrollView>
  );
}

export function AccountSelectorTrigger({ num }: { num: number }) {
  const contextData = useAccountSelectorContextData();
  const { config } = contextData;
  const title = `${config?.sceneName || ''} 账户选择器 🔗  ${num}`;
  const showAccountSelector = useCallback(() => {
    Dialog.show({
      title,
      estimatedContentHeight: 490,
      renderContent: (
        <AccountSelectorProviderMirror config={checkIsDefined(config)}>
          <Content num={num} />
        </AccountSelectorProviderMirror>
      ),
      showFooter: false,
    });
  }, [config, num, title]);
  return <Button onPress={showAccountSelector}>{title}</Button>;
}
