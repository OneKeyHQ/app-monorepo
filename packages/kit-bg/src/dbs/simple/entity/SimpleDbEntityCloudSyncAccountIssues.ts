import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ICloudSyncAccountIssue,
  ICloudSyncAccountIssueUpdate,
} from '@onekeyhq/shared/types/prime/cloudSyncReconciliationState';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

type ICloudSyncAccountIssues = {
  spaceId: string;
  issues: Record<string, ICloudSyncAccountIssue>;
};

export class SimpleDbEntityCloudSyncAccountIssues extends SimpleDbEntityBase<ICloudSyncAccountIssues> {
  entityName = 'cloudSyncAccountIssues';

  override enableCache = true;

  // Background-only: UI receives counts, never this potentially large ID map.
  async updateIssues({
    spaceId,
    updates,
  }: {
    spaceId: string;
    updates: ICloudSyncAccountIssueUpdate[];
  }) {
    const counts = { needsUpdate: 0, pending: 0, conflicts: 0, rejected: 0 };
    await this.setRawData((previous) => {
      const issues =
        previous?.spaceId === spaceId ? { ...previous.issues } : {};
      for (const { id, issue } of updates) {
        if (
          !id ||
          id.length > 256 ||
          ['__proto__', 'prototype', 'constructor'].includes(id)
        )
          throw new OneKeyLocalError('Invalid Cloud issue identity');
        if (issue && !Object.prototype.hasOwnProperty.call(counts, issue))
          throw new OneKeyLocalError('Invalid Cloud issue category');
        if (issue) issues[id] = issue;
        else delete issues[id];
      }
      if (Object.keys(issues).length > 100_000) {
        throw new OneKeyLocalError('Cloud issue capacity exceeded');
      }
      for (const issue of Object.values(issues)) counts[issue] += 1;
      return { spaceId, issues };
    });
    return counts;
  }
}
