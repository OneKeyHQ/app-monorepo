import { renderToStaticMarkup } from 'react-dom/server';

import { EarnPortfolioValue } from './EarnPortfolioValue';

jest.mock('@onekeyhq/components', () => ({
  NumberSizeableText: ({
    children,
    hideValue,
  }: {
    children: string;
    hideValue?: boolean;
  }) => <span>{hideValue ? '****' : children}</span>,
}));

describe('EarnPortfolioValue', () => {
  it('直接显示当前已知金额，不添加同步前缀', () => {
    expect(
      renderToStaticMarkup(<EarnPortfolioValue>42</EarnPortfolioValue>),
    ).toBe('<span>42</span>');
  });

  it('已知金额为零时正常显示零', () => {
    expect(
      renderToStaticMarkup(<EarnPortfolioValue>0</EarnPortfolioValue>),
    ).toBe('<span>0</span>');
  });

  it('无效金额显示不可用，不伪造为零', () => {
    expect(
      renderToStaticMarkup(<EarnPortfolioValue>NaN</EarnPortfolioValue>),
    ).toBe('<span>--</span>');
  });

  it('隐藏金额时沿用隐私展示', () => {
    expect(
      renderToStaticMarkup(
        <EarnPortfolioValue hideValue>42</EarnPortfolioValue>,
      ),
    ).toBe('<span>****</span>');
  });
});
