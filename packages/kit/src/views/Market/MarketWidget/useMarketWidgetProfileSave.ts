import { useCallback, useRef, useState } from 'react';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import type {
  IMarketWidgetProfile,
  IMarketWidgetProfileInput,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import { isMarketWidgetAssetAvailable } from './assetIdentity';

import type { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

type IEditorLifecycle = Pick<
  ReturnType<typeof useMarketWidgetEditorState>,
  'refresh' | 'isMounted' | 'getLifecycleToken' | 'isLifecycleCurrent'
>;

export function useMarketWidgetProfileSave({
  editor,
  validate,
  getInput,
  onPersisted,
  onSaved,
  onError,
}: {
  editor: IEditorLifecycle;
  validate: () => Promise<boolean>;
  getInput: () => IMarketWidgetProfileInput;
  onPersisted: (profile: IMarketWidgetProfile) => void;
  onSaved: () => void;
  onError: (reason: 'unavailable' | 'failed' | undefined) => void;
}) {
  const savingRef = useRef(false);
  const persistedIdRef = useRef<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const lifecycleToken = editor.getLifecycleToken();
    setIsSaving(true);
    onError(undefined);
    try {
      const valid = await validate();
      if (!editor.isLifecycleCurrent(lifecycleToken) || !valid) return;
      if (travelModeManager.isMaskingDataSync()) {
        await editor.refresh();
        return;
      }
      const draft = getInput();
      const input = { ...draft, id: draft.id ?? persistedIdRef.current };
      const latest = await marketWidget.getEditorState();
      if (!editor.isLifecycleCurrent(lifecycleToken)) return;
      if (latest.privacyMasked || travelModeManager.isMaskingDataSync()) {
        await editor.refresh();
        return;
      }
      if (
        input.kind === 'single' &&
        !isMarketWidgetAssetAvailable({
          state: latest,
          source: input.source,
          asset: input.asset,
          profileId: input.id,
        })
      ) {
        onError('unavailable');
        await editor.refresh();
        return;
      }
      const saved = await marketWidget.saveProfile(input);
      // Persistence can finish after blur. Retain its native identity even
      // when the old request must no longer navigate the current screen.
      persistedIdRef.current = saved.id;
      if (editor.isMounted()) onPersisted(saved);
      if (editor.isLifecycleCurrent(lifecycleToken)) {
        onSaved();
      } else if (editor.isLifecycleCurrent(editor.getLifecycleToken())) {
        await editor.refresh();
      }
    } catch {
      if (editor.isLifecycleCurrent(lifecycleToken)) {
        onError('failed');
        await editor.refresh();
      }
    } finally {
      savingRef.current = false;
      if (editor.isMounted()) setIsSaving(false);
    }
  }, [editor, getInput, onError, onPersisted, onSaved, validate]);

  return { isSaving, save };
}
