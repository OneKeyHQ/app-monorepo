import type {
  ICustomInjectedE2EWorkflowSummary,
  ICustomInjectedProtocol,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

export type ICustomInjectedProtocolListE2EStatus = keyof Pick<
  ICustomInjectedE2EWorkflowSummary,
  'adapter' | 'generated' | 'recorded' | 'validated'
>;
export type ICustomInjectedProtocolListE2EFilterValue = 'excluded' | 'included';
export type ICustomInjectedProtocolListFilter = {
  searchValue: string;
  sourceFilter: string[];
  statusFilter: ICustomInjectedProtocol['manualReview']['state'][];
  e2eFilter: Partial<
    Record<
      ICustomInjectedProtocolListE2EStatus,
      ICustomInjectedProtocolListE2EFilterValue
    >
  >;
};
export type ICustomInjectedProtocolFilterRow = {
  position: number;
  protocol: ICustomInjectedProtocol;
  searchText: string;
};

const DEFAULT_FILTER: ICustomInjectedProtocolListFilter = {
  searchValue: '',
  sourceFilter: [],
  statusFilter: [],
  e2eFilter: {},
};
const E2E_STATUS_ORDER: ICustomInjectedProtocolListE2EStatus[] = [
  'recorded',
  'generated',
  'validated',
  'adapter',
];
const listeners = new Set<() => void>();
let filterMemory = DEFAULT_FILTER;

export function getCustomInjectedProtocolListFilter(): ICustomInjectedProtocolListFilter {
  return filterMemory;
}

export function setCustomInjectedProtocolListFilter(
  filter: ICustomInjectedProtocolListFilter,
): void {
  filterMemory = {
    searchValue: filter.searchValue,
    sourceFilter: [...filter.sourceFilter],
    statusFilter: [...filter.statusFilter],
    e2eFilter: { ...filter.e2eFilter },
  };
  listeners.forEach((listener) => listener());
}

export function resetCustomInjectedProtocolListFilter(): void {
  setCustomInjectedProtocolListFilter(DEFAULT_FILTER);
}

export function subscribeCustomInjectedProtocolListFilter(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createCustomInjectedProtocolFilterRows(
  protocols: ICustomInjectedProtocol[],
): ICustomInjectedProtocolFilterRow[] {
  return protocols.map((protocol, index) => ({
    position: index + 1,
    protocol,
    searchText: [
      protocol.source,
      protocol.name,
      protocol.slug,
      protocol.id,
      protocol.url,
      protocol.registryUrl,
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase(),
  }));
}

export function filterCustomInjectedProtocolRows({
  rows,
  filter,
  e2eStates,
}: {
  rows: ICustomInjectedProtocolFilterRow[];
  filter: ICustomInjectedProtocolListFilter;
  e2eStates: Record<string, ICustomInjectedE2EWorkflowSummary>;
}): ICustomInjectedProtocolFilterRow[] {
  const query = filter.searchValue.trim().toLowerCase();
  const sequence = /^#?\d+$/u.test(query)
    ? Number(query.replace(/^#/u, ''))
    : undefined;
  return rows.filter(
    ({ position, protocol, searchText }) =>
      (!filter.sourceFilter.length ||
        filter.sourceFilter.includes(protocol.source)) &&
      (!filter.statusFilter.length ||
        filter.statusFilter.includes(protocol.manualReview.state)) &&
      E2E_STATUS_ORDER.every((status) => {
        const filterValue = filter.e2eFilter[status];
        if (!filterValue) return true;
        const isComplete = Boolean(e2eStates[protocol.key]?.[status]);
        return filterValue === 'included' ? isComplete : !isComplete;
      }) &&
      (!query ||
        (sequence !== undefined
          ? position === sequence
          : searchText.includes(query))),
  );
}
