import { Dialog } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function showConfirmation(description: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (confirmed: boolean) => {
      if (!settled) {
        settled = true;
        resolve(confirmed);
      }
    };
    Dialog.show({
      title: 'Load custom injection workspace?',
      description,
      tone: 'warning',
      icon: 'ErrorOutline',
      dismissOnOverlayPress: false,
      onConfirmText: 'Load workspace',
      onCancelText: 'Cancel',
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

function showError(title: string, description: string) {
  Dialog.show({
    title,
    description,
    tone: 'destructive',
    icon: 'ErrorOutline',
    showCancelButton: false,
    onConfirmText: 'Close',
  });
}

export async function handleCustomInjectedDeepLink(query: {
  workspace?: unknown;
}): Promise<void> {
  const devSettings =
    await backgroundApiProxy.serviceDevSetting.getDevSetting();
  if (!devSettings.enabled) {
    showError(
      'Developer settings required',
      'Enable Developer Settings before opening a custom injection workspace.',
    );
    return;
  }
  const workspace =
    typeof query.workspace === 'string' ? query.workspace.trim() : '';
  if (!workspace) {
    showError(
      'Invalid custom injection link',
      'The DeepLink must include an absolute workspace path.',
    );
    return;
  }

  let sessionId: string | undefined;
  try {
    const preview =
      await globalThis.desktopApiProxy.webview.prepareCustomInjectedWorkspace(
        workspace,
        devSettings.enabled,
      );
    sessionId = preview.sessionId;
    const confirmed = await showConfirmation(
      [
        `Workspace: ${preview.workspace}`,
        `Registry: ${preview.protocolRegistry}`,
        `Desktop preload: ${preview.desktopPreload}`,
        `Protocols: ${String(preview.protocolCount)} (${String(
          preview.pendingCount,
        )} pending)`,
        `Bundle SHA-256: ${preview.bundleSha256}`,
        '',
        'Local JavaScript will run inside real dapp WebViews with the OneKey provider bridge.',
      ].join('\n'),
    );
    if (!confirmed) {
      await globalThis.desktopApiProxy.webview.closeCustomInjectedWorkspace(
        preview.sessionId,
      );
      return;
    }
    const customSession =
      await globalThis.desktopApiProxy.webview.activateCustomInjectedWorkspace(
        preview.sessionId,
      );
    const initialProtocol =
      customSession.protocols.find(
        (protocol) => protocol.manualReview.state === 'pending',
      ) || customSession.protocols[0];
    if (!initialProtocol) {
      throw new OneKeyLocalError('No supported protocol URL is available');
    }
    openUrlInDiscovery({
      url: initialProtocol.url,
      title: initialProtocol.name,
      customInjected: {
        sessionId: customSession.sessionId,
        protocolId: initialProtocol.id,
        preloadUrl: customSession.preloadUrl,
        bundleSha256: customSession.bundleSha256,
        registrySha256: customSession.registrySha256,
      },
    });
  } catch (error) {
    if (sessionId) {
      await globalThis.desktopApiProxy.webview
        .closeCustomInjectedWorkspace(sessionId)
        .catch(() => undefined);
    }
    showError(
      'Unable to load custom injection workspace',
      error instanceof Error ? error.message : String(error),
    );
  }
}
