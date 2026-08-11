import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  ESwitchSize,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { logCustomInjectedClientError } from '@onekeyhq/kit/src/utils/customInjectedClientOperationLog';
import {
  activateCustomInjectedWorkspace,
  deactivateCustomInjectedWorkspace,
  getActiveCustomInjectedWorkspace,
} from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import type { ICustomInjectionDevSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type ICustomInjectionSettingsDialogOptions = {
  suggestedWorkspace?: string;
  onSaved?: (config: ICustomInjectionDevSettings) => Promise<void> | void;
};

function CustomInjectionSettingsDialogContent({
  initialConfig,
  suggestedWorkspace,
  onSaved,
}: ICustomInjectionSettingsDialogOptions & {
  initialConfig: ICustomInjectionDevSettings;
}) {
  const [enabled, setEnabled] = useState(
    suggestedWorkspace ? true : initialConfig.enabled,
  );
  const [workspace, setWorkspace] = useState(
    suggestedWorkspace || initialConfig.workspace,
  );
  const [muteConnectionRequests, setMuteConnectionRequests] = useState(
    initialConfig.muteConnectionRequests ?? false,
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const appliedSuggestedWorkspaceRef = useRef(false);

  const applyConfig = useCallback(
    async (
      nextConfig: ICustomInjectionDevSettings,
    ): Promise<ICustomInjectionDevSettings | undefined> => {
      const normalizedWorkspace = nextConfig.workspace.trim();
      if (nextConfig.enabled && !normalizedWorkspace) {
        setErrorMessage('Select a cross-inpage-provider workspace');
        return undefined;
      }

      setIsUpdating(true);
      setErrorMessage(undefined);
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        if (!devSettings.enabled) {
          throw new OneKeyLocalError('Developer Settings must be enabled');
        }

        const previousConfig = devSettings.settings?.customInjection ?? {
          enabled: false,
          workspace: '',
        };
        const persistedConfig: ICustomInjectionDevSettings = {
          ...previousConfig,
          enabled: nextConfig.enabled,
          workspace: normalizedWorkspace,
          muteConnectionRequests: nextConfig.muteConnectionRequests ?? false,
        };
        if (nextConfig.enabled) {
          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'customInjection',
            persistedConfig,
          );
          try {
            const session = await activateCustomInjectedWorkspace({
              workspace: normalizedWorkspace,
              devSettingsEnabled: devSettings.enabled,
              customInjectionEnabled: true,
            });
            persistedConfig.workspace = session.workspace;
            await backgroundApiProxy.serviceDevSetting.updateDevSetting(
              'customInjection',
              persistedConfig,
            );
          } catch (error) {
            await backgroundApiProxy.serviceDevSetting.updateDevSetting(
              'customInjection',
              previousConfig,
            );
            throw error;
          }
        } else {
          await deactivateCustomInjectedWorkspace();
          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'customInjection',
            persistedConfig,
          );
        }
        setEnabled(persistedConfig.enabled);
        setWorkspace(persistedConfig.workspace);
        setMuteConnectionRequests(
          persistedConfig.muteConnectionRequests ?? false,
        );
        await onSaved?.(persistedConfig);
        setErrorMessage(undefined);
        return persistedConfig;
      } catch (error) {
        const activeSession = getActiveCustomInjectedWorkspace();
        if (activeSession) {
          logCustomInjectedClientError({
            sessionId: activeSession.sessionId,
            operation: 'workspace.settings.apply',
            input: {
              enabled: nextConfig.enabled,
              muteConnectionRequests:
                nextConfig.muteConnectionRequests ?? false,
            },
            error,
          });
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
        return undefined;
      } finally {
        setIsUpdating(false);
      }
    },
    [onSaved],
  );

  const selectWorkspace = useCallback(
    async (enableAfterSelection = enabled) => {
      setIsSelecting(true);
      setErrorMessage(undefined);
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        if (!devSettings.enabled) {
          throw new OneKeyLocalError('Developer Settings must be enabled');
        }
        const previousPersistedConfig = devSettings.settings
          ?.customInjection ?? {
          enabled: false,
          workspace: '',
          muteConnectionRequests: false,
        };
        const temporarilyEnable =
          enableAfterSelection && !previousPersistedConfig.enabled;
        if (temporarilyEnable) {
          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'customInjection',
            {
              ...previousPersistedConfig,
              enabled: true,
              workspace: workspace.trim(),
              muteConnectionRequests,
            },
          );
        }
        let selectionCommitted = false;
        try {
          const selected =
            await globalThis.desktopApiProxy.webview.selectCustomInjectedWorkspace(
              workspace || undefined,
              devSettings.enabled,
            );
          if (!selected) return;
          const previousConfig = {
            enabled,
            workspace,
            muteConnectionRequests,
          };
          setEnabled(enableAfterSelection);
          setWorkspace(selected);
          const persisted = await applyConfig({
            enabled: enableAfterSelection,
            workspace: selected,
            muteConnectionRequests,
          });
          selectionCommitted = Boolean(persisted);
          if (!persisted) {
            setEnabled(previousConfig.enabled);
            setWorkspace(previousConfig.workspace);
            setMuteConnectionRequests(previousConfig.muteConnectionRequests);
          }
        } finally {
          if (temporarilyEnable && !selectionCommitted) {
            await backgroundApiProxy.serviceDevSetting.updateDevSetting(
              'customInjection',
              previousPersistedConfig,
            );
          }
        }
      } catch (error) {
        const activeSession = getActiveCustomInjectedWorkspace();
        if (activeSession) {
          logCustomInjectedClientError({
            sessionId: activeSession.sessionId,
            operation: 'workspace.settings.select',
            error,
          });
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsSelecting(false);
      }
    },
    [applyConfig, enabled, muteConnectionRequests, workspace],
  );

  const changeEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (nextEnabled && !workspace.trim()) {
        await selectWorkspace(true);
        return;
      }
      const previousEnabled = enabled;
      setEnabled(nextEnabled);
      if (
        !(await applyConfig({
          enabled: nextEnabled,
          workspace,
          muteConnectionRequests,
        }))
      ) {
        setEnabled(previousEnabled);
      }
    },
    [applyConfig, enabled, muteConnectionRequests, selectWorkspace, workspace],
  );

  const changeMuteConnectionRequests = useCallback(
    async (nextMuted: boolean) => {
      const previousMuted = muteConnectionRequests;
      setMuteConnectionRequests(nextMuted);
      if (
        !(await applyConfig({
          enabled,
          workspace,
          muteConnectionRequests: nextMuted,
        }))
      ) {
        setMuteConnectionRequests(previousMuted);
      }
    },
    [applyConfig, enabled, muteConnectionRequests, workspace],
  );

  useEffect(() => {
    if (
      !suggestedWorkspace ||
      appliedSuggestedWorkspaceRef.current ||
      (initialConfig.enabled && initialConfig.workspace === suggestedWorkspace)
    ) {
      return;
    }
    appliedSuggestedWorkspaceRef.current = true;
    void applyConfig({
      enabled: true,
      workspace: suggestedWorkspace,
      muteConnectionRequests,
    }).then((persisted) => {
      if (!persisted) {
        setEnabled(initialConfig.enabled);
        setWorkspace(initialConfig.workspace);
      }
    });
  }, [
    applyConfig,
    initialConfig.enabled,
    initialConfig.workspace,
    muteConnectionRequests,
    suggestedWorkspace,
  ]);

  return (
    <YStack gap="$4">
      <XStack alignItems="center" justifyContent="space-between" gap="$4">
        <SizableText size="$bodyMdMedium">Enabled</SizableText>
        <Switch
          size={ESwitchSize.small}
          value={enabled}
          disabled={isSelecting || isUpdating}
          onChange={(value) => void changeEnabled(value)}
          testID="custom-injection-enabled"
        />
      </XStack>

      <YStack gap="$1">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <SizableText size="$bodyMdMedium">
            Mute connection requests
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={muteConnectionRequests}
            disabled={isSelecting || isUpdating}
            onChange={(value) => void changeMuteConnectionRequests(value)}
            testID="custom-injection-mute-connection-requests"
          />
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          Prevent automatic connection requests from opening a modal.
        </SizableText>
      </YStack>

      <YStack gap="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <SizableText size="$bodyMdMedium">
            cross-inpage-provider workspace
          </SizableText>
          <Button
            icon="FolderOpenOutline"
            size="small"
            variant="secondary"
            loading={isSelecting}
            disabled={!enabled || isUpdating}
            onPress={() => void selectWorkspace()}
            testID="custom-injection-select-workspace"
          >
            Choose
          </Button>
        </XStack>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          selectable
          testID="custom-injection-workspace"
        >
          {workspace || 'No folder selected'}
        </SizableText>
      </YStack>
      {errorMessage ? (
        <SizableText
          color="$textCritical"
          size="$bodySm"
          testID="custom-injection-settings-error"
        >
          {errorMessage}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export async function showCustomInjectionSettingsDialog(
  options: ICustomInjectionSettingsDialogOptions = {},
): Promise<boolean> {
  const devSettings =
    await backgroundApiProxy.serviceDevSetting.getDevSetting();
  if (!devSettings.enabled) {
    Dialog.show({
      title: 'Developer Settings required',
      description:
        'Enable Developer Settings before configuring Custom Injection.',
      tone: 'destructive',
      icon: 'ErrorOutline',
      showCancelButton: false,
      onConfirmText: 'Close',
    });
    return false;
  }

  const initialConfig = devSettings.settings?.customInjection ?? {
    enabled: false,
    workspace: '',
  };
  Dialog.show({
    title: 'Custom Injection',
    showFooter: false,
    renderContent: (
      <CustomInjectionSettingsDialogContent
        initialConfig={initialConfig}
        suggestedWorkspace={options.suggestedWorkspace}
        onSaved={options.onSaved}
      />
    ),
  });
  return true;
}
