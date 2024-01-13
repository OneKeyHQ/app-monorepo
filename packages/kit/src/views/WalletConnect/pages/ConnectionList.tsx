import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  ListItem,
  ListView,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProvider } from '../../../components/AccountSelector';

import type { SessionTypes } from '@walletconnect/types';

function getFirstAccount(session: SessionTypes.Struct): string | undefined {
  // Get all the namespace keys
  const namespaceKeys = Object.keys(session.namespaces);

  // Check if there is at least one namespace key
  if (namespaceKeys.length === 0) {
    return undefined; // No namespaces found
  }

  // Get the first namespace key
  const firstNamespaceKey = namespaceKeys[0];

  // Access the first namespace using the key
  const firstNamespace = session.namespaces[firstNamespaceKey];

  // Check if the 'accounts' array exists and has at least one account
  if (firstNamespace.accounts && firstNamespace.accounts.length > 0) {
    // Return the first account of the first namespace
    const [, , account] = firstNamespace.accounts[0].split(':');
    return account;
  }
  return undefined; // No accounts found in the first namespace
}

function ConnectionList() {
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);

  const getActiveSessions = useCallback(async () => {
    const { serviceDApp } = backgroundApiProxy;
    const activeSessions = await serviceDApp.getWalletConnectActiveSessions();
    console.log(activeSessions);
    if (activeSessions) {
      setSessions(Object.values(activeSessions));
    }
  }, []);

  useEffect(() => {
    void getActiveSessions();
  }, [getActiveSessions]);

  const disconnectSession = useCallback(
    async (topic: string) => {
      const { serviceDApp } = backgroundApiProxy;
      await serviceDApp.walletConnectDisconnect(topic);
      void getActiveSessions();
    },
    [getActiveSessions],
  );

  const updateSession = useCallback(
    async (session: SessionTypes.Struct) => {
      const { namespaces } = session;
      const { accounts } = namespaces.eip155;
      const newAccounts = accounts.map((account) => {
        const [namespace, chainId, address] = account.split(':');
        const newAddress =
          address === '0x76f3f64cb3cD19debEE51436dF630a342B736C24'
            ? '0xA9b4d559A98ff47C83B74522b7986146538cD4dF'
            : '0x76f3f64cb3cD19debEE51436dF630a342B736C24';
        return `${namespace}:${chainId}:${newAddress}`;
      });
      const newNamespaces = {
        ...namespaces,
        eip155: {
          ...namespaces.eip155,
          accounts: [...newAccounts],
        },
      };
      const { serviceDApp } = backgroundApiProxy;
      await serviceDApp.updateWalletConnectSession(
        session.topic,
        newNamespaces,
      );
      void getActiveSessions();
    },
    [getActiveSessions],
  );

  return (
    <Page>
      <Page.Header title="WalletConnect Sessions" />
      <Page.Body>
        <ListView
          data={sessions}
          estimatedItemSize="$10"
          renderItem={({ item }) => (
            <ListItem
              title={item.peer.metadata.name}
              subtitle={getFirstAccount(item)}
            >
              {/* <AccountSelectorProvider
                config={{
                  sceneName: EAccountSelectorSceneName.discover,
                  sceneUrl: item.peer.metadata.url,
                }}
                enabledNum={[0]}
              >
                <AccountSelectorTriggerHome num={0} />
              </AccountSelectorProvider> */}
              <ListItem.IconButton
                icon="CrossedSmallOutline"
                iconProps={{
                  color: '$iconActive',
                }}
                onPress={() => disconnectSession(item.topic)}
              />
              <Button onPress={() => updateSession(item)}>
                Update Session
              </Button>
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
