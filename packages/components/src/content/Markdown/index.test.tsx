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

describe('Markdown renderer parity with the previous renderer', () => {
  type IElement = ReactTestRendererJSON;

  const collect = (
    node:
      | ReactTestRendererNode
      | ReactTestRendererNode[]
      | ReactTestRendererJSON[]
      | null,
  ): IElement[] => {
    if (node === null || typeof node === 'string') {
      return [];
    }
    if (Array.isArray(node)) {
      return node.flatMap((child) => collect(child));
    }
    return [node, ...collect(node.children)];
  };

  async function renderMarkdown(source: string) {
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
      renderer = create(<Markdown>{source}</Markdown>);
    });
    consoleErrorSpy.mockRestore();
    return collect(renderer?.toJSON() ?? null);
  }

  it('gives nested inline marks the body text size', async () => {
    const elements = await renderMarkdown(
      '**Full Changelog**: text and ***both***',
    );
    const texts = elements.filter((node) => node.type === 'SizableText');
    const bold = texts.filter((node) => node.props.fontWeight === 'bold');
    const italic = texts.find((node) => node.props.fontStyle === 'italic');

    expect(bold.length).toBeGreaterThan(0);
    bold.forEach((node) => expect(node.props.size).toBe('$bodyMd'));
    expect(italic?.props).toMatchObject({
      fontWeight: 'bold',
      size: '$bodyMd',
    });
  });

  it('renders h3 with the previous font size inside a body-size line', async () => {
    const elements = await renderMarkdown('### 💎 Improvements');
    const heading = elements.find((node) => node.props.pt === '$5');
    const texts = collect(heading?.children ?? null).filter(
      (node) => node.type === 'SizableText',
    );

    expect(texts[0].props).toMatchObject({ size: '$bodyMd' });
    expect(texts[0].props.fontSize).toBeUndefined();
    expect(texts[1].props).toMatchObject({
      fontSize: 18,
      fontWeight: '600',
      size: '$bodyMd',
    });
  });

  it('renders rules as a 1px black line without margins', async () => {
    const elements = await renderMarkdown('Above\n\n---\n\nBelow');
    const rule = elements.find((node) => node.props.height === 1);

    expect(rule?.props).toMatchObject({ bg: '#000000', height: 1 });
    expect(rule?.props.my).toBeUndefined();
  });

  it('underlines links without changing their color', async () => {
    const elements = await renderMarkdown('[OneKey](https://onekey.so)');
    const link = elements.find(
      (node) => node.type === 'SizableText' && node.props.onPress,
    );

    expect(link?.props).toMatchObject({
      color: '$text',
      textDecorationLine: 'underline',
    });
  });
});
