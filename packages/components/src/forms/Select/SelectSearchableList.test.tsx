/**
 * @jest-environment jsdom
 */
import type { ChangeEvent, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { SelectSearchableList } from './SelectSearchableList';

import type { ISelectItem } from './type';

const mockScrollToOffset = jest.fn();
const mockListProps = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'No results' }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('../../primitives', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Stack: Box, SizableText: Box };
});
jest.mock('../../layouts', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListView: React.forwardRef(
      (props: { data: ISelectItem[] }, ref: React.Ref<unknown>) => {
        mockListProps(props);
        React.useImperativeHandle(ref, () => ({
          scrollToOffset: mockScrollToOffset,
        }));
        return (
          <div data-testid="results">
            {props.data.map((item) => (
              <div key={String(item.value)}>{item.label}</div>
            ))}
          </div>
        );
      },
    ),
    SearchBar: ({
      onSearchTextChange,
    }: {
      onSearchTextChange: (text: string) => void;
    }) => {
      const handleChange = React.useCallback(
        (event: ChangeEvent<HTMLInputElement>) =>
          onSearchTextChange(event.target.value),
        [onSearchTextChange],
      );
      return <input aria-label="Search" onChange={handleChange} />;
    },
  };
});

const items: ISelectItem[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文', searchKeywords: ['zh-CN'] },
  { value: 'zh-TW', label: '繁體中文', searchKeywords: ['zh-TW'] },
  { value: 'pt-BR', label: 'Português', searchKeywords: ['Brazil'] },
];
const renderItem = () => null;

it('starts each new search at the top without moving or remounting the search field', () => {
  render(
    <SelectSearchableList items={items} renderItem={renderItem} isSheet />,
  );
  const input = screen.getByRole('textbox', { name: 'Search' });
  input.focus();
  mockScrollToOffset.mockClear();

  fireEvent.change(input, { target: { value: 'z' } });
  expect(screen.getByTestId('results').children).toHaveLength(3);
  expect(mockScrollToOffset).toHaveBeenLastCalledWith({
    offset: 0,
    animated: false,
  });

  fireEvent.change(input, { target: { value: 'zh' } });
  expect(screen.getByTestId('results').children).toHaveLength(2);
  expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('textbox', { name: 'Search' })).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(screen.getByTestId('results').contains(input)).toBe(false);
  expect(mockListProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      maintainVisibleContentPosition: expect.objectContaining({
        disabled: true,
      }),
    }),
  );
});
