import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  ScrollView,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ICustomInjectedSession } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

import type { ICustomInjectedToolbarProps } from './CustomInjectedToolbar/types';

const compactUsd = new Intl.NumberFormat('en', {
  currency: 'USD',
  maximumFractionDigits: 1,
  notation: 'compact',
  style: 'currency',
});

function showError(error: unknown) {
  Toast.error({
    title: error instanceof Error ? error.message : String(error),
  });
}

export default function CustomInjectedToolbar({
  sessionId,
  selectedProtocolId,
  activeBundleSha256,
  onSelectProtocol,
  onReload,
}: ICustomInjectedToolbarProps) {
  const [customSession, setCustomSession] = useState<ICustomInjectedSession>();

  const refresh = useCallback(async () => {
    const next =
      await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
        sessionId,
      );
    setCustomSession(next);
    return next;
  }, [sessionId]);

  useEffect(() => {
    let mounted = true;
    const refreshIfMounted = async () => {
      try {
        const next =
          await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
            sessionId,
          );
        if (mounted) {
          setCustomSession(next);
        }
      } catch (error) {
        if (mounted) {
          showError(error);
        }
      }
    };
    void refreshIfMounted();
    const timer = setInterval(() => {
      void refreshIfMounted();
    }, 2000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  const selectedIndex = useMemo(
    () =>
      customSession?.protocols.findIndex(
        (protocol) => protocol.id === selectedProtocolId,
      ) ?? -1,
    [customSession?.protocols, selectedProtocolId],
  );
  const selectedProtocol =
    selectedIndex >= 0 ? customSession?.protocols[selectedIndex] : undefined;
  const bundleChanged =
    Boolean(customSession?.bundleSha256) &&
    customSession?.bundleSha256 !== activeBundleSha256;

  const selectProtocol = useCallback(
    async (protocolId: string) => {
      try {
        const next = await refresh();
        const protocol = next.protocols.find(
          (candidate) => candidate.id === protocolId,
        );
        if (protocol) {
          onSelectProtocol(protocol, next);
        }
      } catch (error) {
        showError(error);
      }
    },
    [onSelectProtocol, refresh],
  );

  const selectAt = useCallback(
    (index: number) => {
      const protocol = customSession?.protocols[index];
      if (protocol) {
        void selectProtocol(protocol.id);
      }
    },
    [customSession?.protocols, selectProtocol],
  );

  const showProtocolList = useCallback(() => {
    if (!customSession) return;
    const dialog = Dialog.show({
      title: `All protocols (${String(customSession.protocols.length)})`,
      showFooter: false,
      renderContent: (
        <ScrollView maxHeight={600}>
          <YStack gap="$2" p="$1">
            {customSession.protocols.map((protocol, index) => (
              <Button
                key={protocol.id}
                justifyContent="space-between"
                testID={`custom-injected-protocol-${protocol.id}`}
                variant={
                  protocol.id === selectedProtocolId ? 'primary' : 'secondary'
                }
                onPress={() => {
                  void selectProtocol(protocol.id);
                  void dialog.close();
                }}
              >
                {`${String(index + 1)}. ${protocol.name} · ${compactUsd.format(
                  protocol.totalTvl,
                )} · ${
                  protocol.manualReview.state === 'processed'
                    ? 'Processed'
                    : 'Pending'
                }`}
              </Button>
            ))}
          </YStack>
        </ScrollView>
      ),
    });
  }, [customSession, selectProtocol, selectedProtocolId]);

  const editUrl = useCallback(() => {
    if (!customSession || !selectedProtocol) return;
    Dialog.show({
      title: `Edit ${selectedProtocol.name} URL`,
      renderContent: (
        <Dialog.Form
          formProps={{
            values: {
              url: selectedProtocol.url,
            },
          }}
        >
          <Dialog.FormField
            name="url"
            rules={{
              required: {
                message: 'Enter an HTTPS dapp URL',
                value: true,
              },
            }}
          >
            <Input
              autoFocus
              placeholder="https://app.example.com"
              testID="custom-injected-url-input"
            />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm }) => {
        try {
          const url = String(getForm()?.getValues('url') || '').trim();
          const next =
            await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol(
              {
                action: 'set-url',
                sessionId,
                protocolId: selectedProtocol.id,
                expectedRegistrySha256: customSession.registrySha256,
                url,
              },
            );
          setCustomSession(next);
          const updated = next.protocols.find(
            (protocol) => protocol.id === selectedProtocol.id,
          );
          if (updated) {
            onSelectProtocol(updated, next);
          }
        } catch (error) {
          showError(error);
          throw error;
        }
      },
    });
  }, [customSession, onSelectProtocol, selectedProtocol, sessionId]);

  const toggleReview = useCallback(async () => {
    if (!customSession || !selectedProtocol) return;
    try {
      const processed = selectedProtocol.manualReview.state !== 'processed';
      const next =
        await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol({
          action: 'set-review',
          sessionId,
          protocolId: selectedProtocol.id,
          expectedRegistrySha256: customSession.registrySha256,
          state: processed ? 'processed' : 'pending',
          ...(processed
            ? {
                reviewedUrl: selectedProtocol.url,
                bundleSha256: activeBundleSha256,
              }
            : {}),
        });
      setCustomSession(next);
    } catch (error) {
      showError(error);
    }
  }, [activeBundleSha256, customSession, selectedProtocol, sessionId]);

  const reload = useCallback(async () => {
    try {
      onReload(await refresh());
    } catch (error) {
      showError(error);
    }
  }, [onReload, refresh]);

  if (!customSession || !selectedProtocol) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      borderTopColor="$borderSubdued"
      borderTopWidth={1}
      gap="$2"
      px="$3"
      py="$2"
    >
      <Button
        disabled={selectedIndex <= 0}
        size="small"
        testID="custom-injected-previous"
        variant="secondary"
        onPress={() => selectAt(selectedIndex - 1)}
      >
        Previous
      </Button>
      <Button
        disabled={selectedIndex >= customSession.protocols.length - 1}
        size="small"
        testID="custom-injected-next"
        variant="secondary"
        onPress={() => selectAt(selectedIndex + 1)}
      >
        Next
      </Button>
      <Button
        size="small"
        testID="custom-injected-protocol-list"
        variant="secondary"
        onPress={showProtocolList}
      >
        All protocols
      </Button>
      <SizableText flex={1} numberOfLines={1} size="$bodySm" textAlign="center">
        {`${String(selectedIndex + 1)} / ${String(
          customSession.protocols.length,
        )} · ${selectedProtocol.name} · ${selectedProtocol.urlSource}`}
      </SizableText>
      <Button
        size="small"
        testID="custom-injected-edit-url"
        variant="secondary"
        onPress={editUrl}
      >
        Edit URL
      </Button>
      <Button
        size="small"
        testID="custom-injected-reload"
        variant="secondary"
        onPress={reload}
      >
        {bundleChanged ? 'Reload · New bundle' : 'Reload'}
      </Button>
      <Button
        size="small"
        testID="custom-injected-review-state"
        variant={
          selectedProtocol.manualReview.state === 'processed'
            ? 'primary'
            : 'secondary'
        }
        onPress={() => {
          void toggleReview();
        }}
      >
        {selectedProtocol.manualReview.state === 'processed'
          ? 'Processed'
          : 'Pending'}
      </Button>
    </XStack>
  );
}
