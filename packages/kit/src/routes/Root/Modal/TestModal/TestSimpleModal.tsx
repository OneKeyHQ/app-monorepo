import { useCallback, useState } from 'react';

import { Page, Switch, Text, XStack } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/Navigation/Header/HeaderIconButton';

export default function TestSimpleModal() {
  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );
  const [showFooter, changeFooterStatus] = useState(true);
  const [showCustomFooter, changeCustomFooterStatus] = useState(false);
  return (
    <Page>
      <Page.Header title="test modal" headerRight={headerRightCall} />
      <Page.Body>
        <XStack>
          <Switch value={showFooter} onChange={changeFooterStatus} />
          <Text>{showFooter ? 'Show Footer' : 'Hide Fotter'}</Text>
        </XStack>
        <XStack>
          <Switch
            value={showCustomFooter}
            onChange={changeCustomFooterStatus}
          />
          <Text>{showFooter ? 'Show Footer' : 'Hide Fotter'}</Text>
        </XStack>
        <Text>这是一个普通的 Modal 测试</Text>
      </Page.Body>
      {showFooter ? (
        <Page.Footer
          onConfirm={() => alert('confirmed')}
          onConfirmText="YES"
          onCancel={() => {
            alert('cancel');
          }}
          onCancelText="NO"
        >
          {showCustomFooter ? <Text>Custom Footer</Text> : null}
        </Page.Footer>
      ) : null}
    </Page>
  );
}
