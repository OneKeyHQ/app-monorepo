import { Markdown } from '.';

import { act, create } from 'react-test-renderer';

import type {
  ReactTestRendererJSON,
  ReactTestRendererNode,
} from 'react-test-renderer';

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Image = Object.assign(
    (props: Record<string, unknown>) => React.createElement('Image', props),
    {
      getSize: (
        _uri: string,
        onSuccess: (width: number, height: number) => void,
      ) => onSuccess(200, 100),
    },
  );
  return {
    Image,
    Pressable: 'Pressable',
  };
});

jest.mock('../../hooks/useStyle', () => ({
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('../../primitives/SizeableText', () => ({
  SizableText: 'SizableText',
}));

jest.mock('../../primitives/Stack', () => ({
  Stack: 'Stack',
  XStack: 'XStack',
  YStack: 'YStack',
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

describe('Markdown renderer', () => {
  it('keeps mixed paragraph images outside text containers', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    let renderer: ReturnType<typeof create> | undefined;
    await act(() => {
      renderer = create(
        <Markdown>
          Before ![OneKey](https://assets.onekey.so/logo.png) after
        </Markdown>,
      );
    });

    const collectElements = (
      node:
        | ReactTestRendererNode
        | ReactTestRendererNode[]
        | ReactTestRendererJSON[]
        | null,
    ): ReactTestRendererJSON[] => {
      if (node === null || typeof node === 'string') {
        return [];
      }
      if (Array.isArray(node)) {
        return node.flatMap((child) => collectElements(child));
      }
      return [node, ...collectElements(node.children)];
    };
    const elements = collectElements(renderer?.toJSON() ?? null);
    const textNodes = elements.filter((node) => node.type === 'SizableText');
    expect(textNodes).not.toHaveLength(0);
    expect(
      textNodes.some((textNode) =>
        collectElements(textNode.children).some(
          (node) => node.type === 'Image',
        ),
      ),
    ).toBe(false);
    expect(elements.filter((node) => node.type === 'Image')).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('react-test-renderer is deprecated'),
    );
    consoleErrorSpy.mockRestore();
  });
});
