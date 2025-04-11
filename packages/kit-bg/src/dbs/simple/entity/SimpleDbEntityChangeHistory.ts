import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  EChangeHistoryContentType,
  IChangeHistoryItem,
  IChangeHistoryUpdateItem,
} from '@onekeyhq/shared/src/types/changeHistory';
import { EChangeHistoryEntityType } from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Using IChangeHistoryItem from shared types

export interface IChangeHistoryContentTypeMap {
  [contentKey: string]: IChangeHistoryItem; // contentKey is the content value (e.g., the name)
}

export interface IChangeHistoryEntityMap {
  [key: string]: IChangeHistoryContentTypeMap; // key is contentType string value ('name', 'memo', etc.)
}

export interface IChangeHistoryEntityContent {
  [contentKey: string]: IChangeHistoryItem;
}

export interface IChangeHistoryEntityContentTypes {
  [contentType: string]: IChangeHistoryEntityContent;
}

export interface IChangeHistoryEntityIds {
  [entityId: string]: IChangeHistoryEntityContentTypes;
}

export interface IChangeHistoryData {
  [entityType: string]: IChangeHistoryEntityIds;
}

export class SimpleDbEntityChangeHistory extends SimpleDbEntityBase<IChangeHistoryData> {
  entityName = 'changeHistory';

  override enableCache = false;

  @backgroundMethod()
  async getChangeHistory(params: {
    entityType?: EChangeHistoryEntityType;
    entityId?: string;
    contentType?: EChangeHistoryContentType;
  }): Promise<IChangeHistoryItem[]> {
    const { entityType, entityId, contentType } = params;
    const data = await this.getRawData();

    // If both entityType and entityId are provided, we can directly access the entity
    if (entityType && entityId) {
      const entityData =
        (data?.[entityType as string]?.[
          entityId
        ] as IChangeHistoryEntityContentTypes) || {};

      // If contentType is provided, return only that content type's history
      if (contentType) {
        const contentTypeData = entityData[contentType as string] || {};
        return Object.values(contentTypeData).sort(
          (a, b) => b.timestamp - a.timestamp,
        );
      }

      // Otherwise, return all content types for this entity
      const result: IChangeHistoryItem[] = [];
      Object.values(entityData).forEach(
        (contentTypeMap: IChangeHistoryEntityContent) => {
          result.push(...Object.values(contentTypeMap));
        },
      );
      return result.sort((a, b) => b.timestamp - a.timestamp);
    }

    // If only entityType is provided, collect all entities of that type
    if (entityType) {
      const result: IChangeHistoryItem[] = [];
      const entityTypeData =
        (data?.[entityType as string] as IChangeHistoryEntityIds) || {};

      Object.values(entityTypeData).forEach(
        (entityData: IChangeHistoryEntityContentTypes) => {
          if (contentType) {
            const contentTypeData = entityData[contentType as string] || {};
            result.push(...Object.values(contentTypeData));
          } else {
            Object.values(entityData).forEach(
              (contentTypeMap: IChangeHistoryEntityContent) => {
                result.push(...Object.values(contentTypeMap));
              },
            );
          }
        },
      );

      return result.sort((a, b) => b.timestamp - a.timestamp);
    }

    // If only contentType is provided, collect all entities with that content type
    if (contentType) {
      const result: IChangeHistoryItem[] = [];

      Object.values(data || {}).forEach(
        (entityTypeData: IChangeHistoryEntityIds) => {
          Object.values(entityTypeData).forEach(
            (entityData: IChangeHistoryEntityContentTypes) => {
              const contentTypeData = entityData[contentType as string] || {};
              result.push(...Object.values(contentTypeData));
            },
          );
        },
      );

      return result.sort((a, b) => b.timestamp - a.timestamp);
    }

    // If no filters are provided, return all history items
    const result: IChangeHistoryItem[] = [];

    Object.values(data || {}).forEach(
      (entityTypeData: IChangeHistoryEntityIds) => {
        Object.values(entityTypeData).forEach(
          (entityData: IChangeHistoryEntityContentTypes) => {
            Object.values(entityData).forEach(
              (contentTypeMap: IChangeHistoryEntityContent) => {
                result.push(...Object.values(contentTypeMap));
              },
            );
          },
        );
      },
    );

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  @backgroundMethod()
  async addChangeHistory({
    items,
  }: {
    items: IChangeHistoryUpdateItem[];
  }): Promise<void> {
    await this.setRawData((data) => {
      const newData = data ? { ...data } : ({} as IChangeHistoryData);
      const timestamp = Date.now();

      items.forEach((item) => {
        const { entityType, entityId, contentType, oldValue, value } = item;

        const trimmedValue = value?.trim();
        if (!entityId || !value || !trimmedValue || value === oldValue) {
          return;
        }
        if (
          entityType === EChangeHistoryEntityType.Account &&
          accountUtils.isUrlAccountFn({
            accountId: entityId,
          })
        ) {
          return;
        }

        const entityTypeKey = entityType as string;
        const contentTypeKey = contentType as string;

        // Ensure the entity type exists in the map
        if (!newData[entityTypeKey]) {
          newData[entityTypeKey] = {};
        }

        // Ensure the entity ID exists for this entity type
        if (!newData[entityTypeKey][entityId]) {
          newData[entityTypeKey][entityId] = {};
        }

        // Ensure the content type exists for this entity
        if (!newData[entityTypeKey][entityId][contentTypeKey]) {
          newData[entityTypeKey][entityId][contentTypeKey] = {};
        }

        // Add the new history item
        const contentKey = value;
        newData[entityTypeKey][entityId][contentTypeKey][contentKey] = {
          oldValue,
          value,
          timestamp,
        };

        if (oldValue) {
          const oldContentKey = oldValue;
          if (
            !newData[entityTypeKey][entityId][contentTypeKey][oldContentKey]
          ) {
            newData[entityTypeKey][entityId][contentTypeKey][oldContentKey] = {
              oldValue,
              value: oldValue,
              timestamp: timestamp - 1,
            };
          }
        }
      });

      return newData;
    });
  }
}
