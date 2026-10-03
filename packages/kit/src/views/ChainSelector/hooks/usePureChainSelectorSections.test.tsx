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
  useFuseSearch: () => jest.fn(),
}));

describe('usePureChainSelectorSections', () => {
  it('groups legacy names without whitespace section keys or changing saved names', () => {
    const names = [
      ' Ethereum ',
      '\tEthereum',
      '\u00a0Ethereum\u00a0',
      'Base ',
      ' \t ',
      '',
    ];
    const networks = names.map(
      (name, index) =>
        ({ id: `custom--${index}`, name, isTestnet: false }) as IServerNetwork,
    );
    const { result } = renderHook(() =>
      usePureChainSelectorSections({ networks, searchKey: '' }),
    );

    expect(result.current.sections.map((section) => section.title)).toEqual([
      '#',
      'B',
      'E',
    ]);
    expect(
      result.current.sections.map((section) => section.data.length),
    ).toEqual([2, 1, 3]);
    expect(networks.map((network) => network.name)).toEqual(names);
  });
});
