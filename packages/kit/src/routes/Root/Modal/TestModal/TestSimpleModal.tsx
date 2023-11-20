import { useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Page, Switch, Text, XStack } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/Navigation/Header/HeaderIconButton';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { EModalTestRoutes } from './Routes';

import type { ITabHomeParamList } from '../../Tab/Home/Routes';

export default function TestSimpleModal() {
  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );
  const [showFooter, changeFooterStatus] = useState(true);
  const [showCustomFooter, changeCustomFooterStatus] = useState(false);
  const [showNewHeader, changeNewHeaderStatus] = useState(false);

  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();
  const navigateToNextPage = useCallback(() => {
    navigation.push(EModalTestRoutes.TestSimpleModal);
  }, [navigation]);
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
        <XStack>
          <Switch value={showNewHeader} onChange={changeNewHeaderStatus} />
          <Text>{showNewHeader ? 'Show New Header' : 'Hide New Header'}</Text>
        </XStack>
        <Text>这是一个普通的 Modal 测试</Text>
        <Button onPress={navigateToNextPage}>Push Next Page</Button>
      </Page.Body>
      {showNewHeader ? (
        <XStack>
          <Page.Header title="new title" />
        </XStack>
      ) : null}
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
