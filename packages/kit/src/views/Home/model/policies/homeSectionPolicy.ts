import type {
  IHomeConfirmedFact,
  IHomeFactResource,
  IHomePortfolioFactData,
  IHomeSectionFactData,
} from '../facts/homeFacts';
import type {
  IHomeSectionId,
  IHomeSectionSemanticModel,
} from '../semantic/homeSemanticTypes';

function getRowIds(
  data: IHomePortfolioFactData | IHomeSectionFactData,
): readonly string[] {
  if ('rows' in data && data.rows) {
    return data.rows.map((row) => row.id);
  }
  return [];
}

function projectConfirmed(
  confirmed: IHomeConfirmedFact | undefined,
): IHomeSectionSemanticModel | undefined {
  if (!confirmed) {
    return undefined;
  }
  const rowIds = getRowIds(confirmed.data);
  return rowIds.length === 0
    ? undefined
    : {
        kind: 'ready',
        rowIds,
        freshness: 'confirmedCache',
        refresh: 'failed',
      };
}

export function projectHomeSection({
  applicable,
  confirmed,
  id,
  resource,
}: {
  applicable: boolean;
  confirmed?: IHomeConfirmedFact;
  id: IHomeSectionId;
  resource: IHomeFactResource<IHomePortfolioFactData | IHomeSectionFactData>;
}): IHomeSectionSemanticModel {
  if (!applicable) {
    return { kind: 'hidden', reason: 'notApplicable' };
  }
  if (
    resource.kind === 'idle' ||
    resource.kind === 'loading' ||
    resource.kind === 'partial'
  ) {
    return { kind: 'loading', placeholder: id };
  }
  if (resource.kind === 'error') {
    return projectConfirmed(confirmed) ?? { kind: 'error', errorState: id };
  }
  if (resource.result.kind === 'empty') {
    return { kind: 'empty', emptyState: id };
  }
  const rowIds = getRowIds(resource.result.data);
  return rowIds.length === 0
    ? { kind: 'empty', emptyState: id }
    : {
        kind: 'ready',
        rowIds,
        freshness: 'live',
        refresh: 'idle',
      };
}
