import { useCallback, useRef, useState } from 'react';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type { IMarketWidgetProfileInput } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import {
  isMarketWidgetAssetAvailable,
  isMarketWidgetManualAssetAvailable,
} from './assetIdentity';

import type { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

type IEditorLifecycle = Pick<
  ReturnType<typeof useMarketWidgetEditorState>,
  'refresh' | 'isMounted' | 'getLifecycleToken' | 'isLifecycleCurrent'
>;

export function useMarketWidgetProfileSave({
  editor,
  editorSession,
  validate,
  getInput,
  onSaved,
  onError,
}: {
  editor: IEditorLifecycle;
  editorSession?: string;
  validate: () => Promise<boolean>;
  getInput: () => IMarketWidgetProfileInput;
  onSaved: () => void;
  onError: (reason: 'unavailable' | 'failed' | undefined) => void;
}) {
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const lifecycleToken = editor.getLifecycleToken();
    logMarketWidgetEvent(
      'editor.save_started',
      { lifecycleToken },
      editorSession,
    );
    setIsSaving(true);
    onError(undefined);
    try {
      const valid = await validate();
      if (!editor.isLifecycleCurrent(lifecycleToken) || !valid) {
        logMarketWidgetEvent(
          'editor.save_skipped',
          { reason: valid ? 'lifecycle_changed' : 'validation_failed' },
          editorSession,
        );
        return;
      }
      if (travelModeManager.isMaskingDataSync()) {
        await editor.refresh();
        return;
      }
      const input = getInput();
      const latest = await marketWidget.getEditorState(editorSession);
      if (!editor.isLifecycleCurrent(lifecycleToken)) return;
      if (latest.privacyMasked || travelModeManager.isMaskingDataSync()) {
        await editor.refresh();
        return;
      }
      if (
        input.assets
          ? input.assets.length !== (input.kind === 'single' ? 1 : 3) ||
            input.assets.some(
              (asset) =>
                !isMarketWidgetManualAssetAvailable({
                  state: latest,
                  asset,
                  kind: input.kind,
                }),
            )
          : input.kind === 'single' &&
            !isMarketWidgetAssetAvailable({
              state: latest,
              source: input.source,
              asset: input.asset,
              kind: input.kind,
            })
      ) {
        onError('unavailable');
        await editor.refresh();
        return;
      }
      await marketWidget.saveSettings(input, editorSession);
      logMarketWidgetEvent(
        'editor.save_succeeded',
        { kind: input.kind, slotCount: input.assets?.length },
        editorSession,
      );
      if (editor.isLifecycleCurrent(lifecycleToken)) {
        onSaved();
      } else if (editor.isLifecycleCurrent(editor.getLifecycleToken())) {
        await editor.refresh();
      }
    } catch (error) {
      logMarketWidgetEvent('editor.save_failed', {}, editorSession, error);
      if (editor.isLifecycleCurrent(lifecycleToken)) {
        onError('failed');
        await editor.refresh();
      }
    } finally {
      savingRef.current = false;
      if (editor.isMounted()) setIsSaving(false);
    }
  }, [editor, editorSession, getInput, onError, onSaved, validate]);

  return { isSaving, save };
}
