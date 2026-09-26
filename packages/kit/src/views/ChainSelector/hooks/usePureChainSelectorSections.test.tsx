/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import type { IServerNetwork } from '@onekeyhq/shared/types';

import { usePureChainSelectorSections } from './usePureChainSelectorSections';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('./useFuseSearch', () => ({
  useFuseSearch: () => () => [],
}));

describe('usePureChainSelectorSections', () => {
  it('groups existing network names with surrounding whitespace safely', () => {
    const networks = [
      { id: 'leading', name: ' TT Chain', isTestnet: false },
      { id: 'trailing', name: 'TT Chain ', isTestnet: false },
      { id: 'blank', name: ' \u00a0\u3000', isTestnet: false },
      { id: 'cjk', name: ' 中文链', isTestnet: false },
    ] as IServerNetwork[];

    const { result } = renderHook(() =>
      usePureChainSelectorSections({ networks, searchKey: '' }),
    );

    expect(
      result.current.sections.map((section) => ({
        title: section.title,
        ids: section.data.map((network) => network.id),
      })),
    ).toEqual([
      { title: '#', ids: ['blank'] },
      { title: 'T', ids: ['leading', 'trailing'] },
      { title: '中', ids: ['cjk'] },
    ]);
  });
});
