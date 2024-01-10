import { useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Page,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ETestModalPages } from '../router/type';

import type { ITabHomeParamList } from '../../Home/router';

export function TestSimpleModal() {
  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );
  const [showHeader, changeHeaderStatus] = useState(true);
  const [showFooter, changeFooterStatus] = useState(true);
  const [showCustomFooter, changeCustomFooterStatus] = useState(false);
  const [showNewHeader, changeNewHeaderStatus] = useState(false);

  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();
  const navigateToNextPage = useCallback(() => {
    navigation.push(ETestModalPages.TestSimpleModal);
  }, [navigation]);
  return (
    <Page>
      <Page.Header
        title="test modal"
        headerShown={showHeader}
        headerRight={headerRightCall}
      />
      <Page.Body bg="burlywood">
        <XStack>
          <Switch value={showHeader} onChange={changeHeaderStatus} />
          <SizableText>
            {showHeader ? 'Show Header' : 'Hide Header'}
          </SizableText>
        </XStack>
        <XStack>
          <Switch value={showFooter} onChange={changeFooterStatus} />
          <SizableText>
            {showFooter ? 'Show Footer' : 'Hide Fotter'}
          </SizableText>
        </XStack>
        <XStack>
          <Switch
            value={showCustomFooter}
            onChange={changeCustomFooterStatus}
          />
          <SizableText>
            {showCustomFooter ? 'Show Custom Footer' : 'Hide Custom Fotter'}
          </SizableText>
        </XStack>
        <XStack>
          <Switch value={showNewHeader} onChange={changeNewHeaderStatus} />
          <SizableText>
            {showNewHeader ? 'Show New Header' : 'Hide New Header'}
          </SizableText>
        </XStack>
        <SizableText>这是一个普通的 Modal 测试</SizableText>
        <YStack space="$4" m="$4">
          <Button onPress={navigateToNextPage}>Push to Next Page</Button>
          <Page.Close>
            <Button>Back To Pervious Page</Button>
          </Page.Close>
          <Page.Close>
            <Button
              onPress={() =>
                new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(false);
                    alert('false');
                  }, 3000);
                })
              }
            >
              Back To Pervious Page --- async fail
            </Button>
          </Page.Close>
          <Page.Close>
            <Button
              onPress={() =>
                new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(true);
                  }, 3000);
                })
              }
            >
              Back To Pervious Page --- async success
            </Button>
          </Page.Close>
        </YStack>
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
              <SizableText>+</SizableText>
              <Button>Done</Button>
            </XStack>
          ) : null}
        </Page.Footer>
      ) : null}
    </Page>
  );
}
