import { useCallback, useState } from 'react';

import { Button, Page, Switch, Text, XStack } from '@onekeyhq/components';
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
      <Page.Body bg="burlywood">
        <XStack>
          <Switch value={showFooter} onChange={changeFooterStatus} />
          <Text>{showFooter ? 'Show Footer' : 'Hide Fotter'}</Text>
        </XStack>
        <XStack>
          <Switch
            value={showCustomFooter}
            onChange={changeCustomFooterStatus}
          />
          <Text>
            {showCustomFooter ? 'Show Custom Footer' : 'Hide Custom Fotter'}
          </Text>
        </XStack>
        <Text>这是一个普通的 Modal 测试</Text>
      </Page.Body>
      {showFooter ? (
        <Page.Footer
          onConfirm={() => alert('confirmed')}
          onConfirmText="YES"
          confirmButtonProps={{
            w: '$40',
          }}
          onCancel={() => {
            alert('cancel');
          }}
          onCancelText="NO"
        >
          {showCustomFooter ? (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              width="100%"
            >
              <Button>Close All</Button>
              <Text>+</Text>
              <Button>Done</Button>
            </XStack>
          ) : null}
        </Page.Footer>
      ) : null}
    </Page>
  );
}
