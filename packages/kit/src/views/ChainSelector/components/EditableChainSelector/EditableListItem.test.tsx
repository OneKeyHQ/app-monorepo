/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { EditableChainSelectorContext } from './context';
import { EditableListItem } from './EditableListItem';

import type { IEditableChainSelectorContext } from './type';
import type { IServerNetworkMatch } from '../../types';

// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];

// Identity-stable intl: `intl` is a dependency of the renderItemText
// useCallback, so a fresh object per render would defeat the identity
// assertions below without exercising the memoization under test.
const mockIntl = { formatMessage: () => '' };

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Button: () => null,
    SizableText: () => null,
    XStack: Passthrough,
  };
});

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({ renderItemText }: { renderItemText?: unknown }) => {
    capturedRenderItemTexts.push(renderItemText);
    return null;
  };
  ListItemMock.Text = () => null;
  ListItemMock.IconButton = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: () => null,
}));

const networkItem = {
  id: 'evm--1',
  name: 'Ethereum',
  isAllNetworks: false,
} as unknown as IServerNetworkMatch;

// Values referenced by hook dependencies must keep their identity across
// renders, exactly like the real (memoized) context value does.
const onPressItem = jest.fn();
const accountNetworkValues: IEditableChainSelectorContext['accountNetworkValues'] =
  {};
const accountDeFiOverview: IEditableChainSelectorContext['accountDeFiOverview'] =
  {};

function buildContextValue(
  overrides: Partial<IEditableChainSelectorContext> = {},
): IEditableChainSelectorContext {
  return {
    walletId: 'hd-1',
    frequentlyUsedItems: [],
    frequentlyUsedItemsIds: new Set(),
    accountNetworkValues,
    accountDeFiOverview,
    onPressItem,
    networkId: undefined,
    ...overrides,
  };
}

function renderItem(contextValue: IEditableChainSelectorContext) {
  return (
    <EditableChainSelectorContext.Provider value={contextValue}>
      <EditableListItem item={networkItem} />
    </EditableChainSelectorContext.Provider>
  );
}

describe('EditableListItem render prop stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedRenderItemTexts = [];
  });

  it('keeps the renderItemText identity stable when re-rendered with the same inputs', () => {
    // ListItem renders renderItemText as a component type
    // (`<Render {...props} />`), so a new function identity per render means
    // React unmounts and remounts the whole text subtree — which also makes
    // Chromium drop a click whose mousedown target left the tree mid-press.
    // Reverting the useCallback to an inline arrow would fail this test.
    const contextValue = buildContextValue();
    const view = render(renderItem(contextValue));
    view.rerender(renderItem(contextValue));

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(typeof capturedRenderItemTexts[0]).toBe('function');
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });

  it('keeps the renderItemText identity stable across an unrelated context change', () => {
    // Selecting another network only changes the row highlight (`bg`), not
    // anything renderItemText depends on, so the render prop identity must
    // survive that re-render.
    const view = render(renderItem(buildContextValue()));
    view.rerender(renderItem(buildContextValue({ networkId: 'evm--56' })));

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });
});
