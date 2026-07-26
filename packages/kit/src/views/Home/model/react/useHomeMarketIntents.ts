import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { getTokenKey } from '../../components/PopularTrading/utils';
import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_MARKET_ACTION_IDS } from '../sections/market/homeMarketCommands';
import { HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID } from '../sections/market/homeMarketControls';
import { getHomeMarketTokenRowId } from '../sections/market/homeMarketSourceAdapter';
import { normalizeHomeStoreJson } from '../store/homeStoreJson';

import type {
  IFavoriteTokenDisplay,
  IHomePopularTradingPayload,
} from '../../components/PopularTrading/types';
import type { IHomeStoreIntent } from '../store/homeStoreTypes';

export function useHomeMarketIntents() {
  const facts = useHomeFacts();
  const marketSection = useHomeSection('market');
  const { dispatchHomeIntent, executeHomeCommand } =
    useHomeStoreIntentActions().current;

  const dispatchSectionAction = useCallback(
    ({
      actionId,
      commandPayload,
      itemId,
    }: {
      actionId: (typeof HOME_MARKET_ACTION_IDS)[keyof typeof HOME_MARKET_ACTION_IDS];
      commandPayload?: IHomeRuntimeJsonValue;
      itemId?: string;
    }) => {
      if (!facts) {
        return undefined;
      }
      const intentId = createHomeAuthorityId('intent');
      const intent: IHomeStoreIntent = {
        type: 'sectionActionInvoked',
        intentId,
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        sectionId: 'market',
        actionId,
        commandPayload,
        itemId,
        authority: {
          kind: 'sectionCommands',
          sectionId: 'market',
          revision: marketSection.sectionCommandRevision,
        },
      };
      return intent;
    },
    [facts, marketSection.sectionCommandRevision],
  );

  const selectCategory = useCallback(
    (categoryId: string) => {
      if (!facts) {
        return false;
      }
      const receipt = dispatchHomeIntent({
        type: 'sectionControlChanged',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        sectionId: 'market',
        controlId: HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID,
        value: categoryId,
        authority: {
          kind: 'sectionCommands',
          sectionId: 'market',
          revision: marketSection.sectionCommandRevision,
        },
      });
      return receipt.accepted;
    },
    [dispatchHomeIntent, facts, marketSection.sectionCommandRevision],
  );

  const addRecommended = useCallback(
    async (tokens: IFavoriteTokenDisplay[]) => {
      const commandPayload = normalizeHomeStoreJson({ tokens });
      const intent =
        commandPayload === undefined
          ? undefined
          : dispatchSectionAction({
              actionId: HOME_MARKET_ACTION_IDS.addRecommended,
              commandPayload,
              itemId: tokens.map(getTokenKey).join('|'),
            });
      if (tokens.length === 0 || !intent) {
        return false;
      }
      const completion = await executeHomeCommand<boolean>(intent).completion;
      return completion.kind === 'completed' && completion.value;
    },
    [dispatchSectionAction, executeHomeCommand],
  );

  const removeFavorite = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      const commandPayload = normalizeHomeStoreJson({ record });
      const intent =
        commandPayload === undefined
          ? undefined
          : dispatchSectionAction({
              actionId: HOME_MARKET_ACTION_IDS.removeFavorite,
              commandPayload,
              itemId: getHomeMarketTokenRowId(record),
            });
      if (!intent) {
        return false;
      }
      const completion = await executeHomeCommand<boolean>(intent).completion;
      return completion.kind === 'completed' && completion.value;
    },
    [dispatchSectionAction, executeHomeCommand],
  );

  const toggleFavorite = useCallback(
    async ({
      checked,
      record,
      watchListItems,
    }: {
      checked: boolean;
      record: IFavoriteTokenDisplay;
      watchListItems: IHomePopularTradingPayload['watchListItems'];
    }) => {
      const commandPayload = normalizeHomeStoreJson({
        checked,
        firstSortIndex: watchListItems[0]?.sortIndex ?? 1000,
        record,
      });
      const intent =
        commandPayload === undefined
          ? undefined
          : dispatchSectionAction({
              actionId: HOME_MARKET_ACTION_IDS.toggleFavorite,
              commandPayload,
              itemId: getHomeMarketTokenRowId(record),
            });
      if (!intent) {
        return false;
      }
      const completion = await executeHomeCommand<boolean>(intent).completion;
      return completion.kind === 'completed' && completion.value;
    },
    [dispatchSectionAction, executeHomeCommand],
  );

  const openToken = useCallback(
    (record: IFavoriteTokenDisplay) => {
      const intent = dispatchSectionAction({
        actionId: HOME_MARKET_ACTION_IDS.openToken,
        itemId: getHomeMarketTokenRowId(record),
      });
      if (!intent) {
        return;
      }
      void executeHomeCommand<void>(intent).completion;
    },
    [dispatchSectionAction, executeHomeCommand],
  );

  const viewMore = useCallback(
    (selectedMarketCategoryId?: string) => {
      const intent = dispatchSectionAction({
        actionId: HOME_MARKET_ACTION_IDS.viewMore,
        itemId: selectedMarketCategoryId,
      });
      if (!intent) {
        return;
      }
      void executeHomeCommand<void>(intent).completion;
    },
    [dispatchSectionAction, executeHomeCommand],
  );

  return {
    addRecommended,
    openToken,
    removeFavorite,
    selectCategory,
    toggleFavorite,
    viewMore,
  };
}

export { HOME_MARKET_ACTION_IDS };
