import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  ListItem,
  ListView,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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
              <ListItem.IconButton
                icon="CrossedSmallOutline"
                iconProps={{
                  color: '$iconActive',
                }}
                onPress={() => disconnectSession(item.topic)}
              />
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
