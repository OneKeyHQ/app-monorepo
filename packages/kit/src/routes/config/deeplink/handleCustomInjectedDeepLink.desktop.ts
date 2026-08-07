import { Dialog } from '@onekeyhq/components';
import { activateCustomInjectedWorkspace } from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import { showCustomInjectionSettingsDialog } from '@onekeyhq/kit/src/views/Discovery/components/CustomInjectionSettingsDialog';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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
  url?: unknown;
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
  const targetUrl = typeof query.url === 'string' ? query.url.trim() : '';
  if (targetUrl && !isAllowedWebViewUrl(targetUrl)) {
    showError(
      'Invalid custom injection link',
      'The target URL must be a safe HTTP or HTTPS dapp URL.',
    );
    return;
  }

  const currentConfig = devSettings.settings?.customInjection;
  const canReuseCurrentConfig = Boolean(
    currentConfig?.enabled &&
    currentConfig.workspace &&
    ((workspace && currentConfig.workspace === workspace) ||
      (!workspace && targetUrl)),
  );
  if (canReuseCurrentConfig && currentConfig) {
    try {
      await activateCustomInjectedWorkspace({
        workspace: currentConfig.workspace,
        devSettingsEnabled: devSettings.enabled,
        customInjectionEnabled: currentConfig.enabled,
      });
      if (targetUrl) {
        openUrlInDiscovery({ url: targetUrl });
      }
      return;
    } catch (error) {
      showError(
        'Unable to load custom injection workspace',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  await showCustomInjectionSettingsDialog({
    suggestedWorkspace: workspace || undefined,
    onSaved: (config) => {
      if (config.enabled && targetUrl) {
        openUrlInDiscovery({ url: targetUrl });
      }
    },
  });
}
