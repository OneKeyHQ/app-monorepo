import { createIntl, createIntlCache } from 'react-intl';

import { formatScaleOrderValidationError } from './scaleOrderValidation';

const cache = createIntlCache();

describe('formatScaleOrderValidationError', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const intl = createIntl(
    {
      locale: 'en-US',
      messages: {
        perp_scale_order_size_too_small__msg: 'Order size is too small',
        perp_scale_order_min_notional__msg:
          'Each scale order must be at least {amount}. Reduce order count or increase size.',
      } as Record<string, string>,
    },
    cache,
  );
  const zhIntl = createIntl(
    {
      locale: 'zh-CN',
      messages: {
        perp_scale_order_size_too_small__msg: '订单数量过小',
        perp_scale_order_min_notional__msg:
          '每笔分段委托金额至少为 {amount}。请减少委托笔数或增加数量。',
      } as Record<string, string>,
    },
    cache,
  );

  it('formats scale size too small errors', () => {
    expect(
      formatScaleOrderValidationError(
        intl,
        { code: 'sizeTooSmall', legIndex: 0 },
        'Leg 1: size is too small',
      ),
    ).toBe('Order size is too small');
  });

  it('formats scale min notional errors', () => {
    expect(
      formatScaleOrderValidationError(
        intl,
        { code: 'minNotionalTooSmall', legIndex: 0, minNotional: '10' },
        'Leg 1: notional must be at least $10',
      ),
    ).toBe(
      'Each scale order must be at least $10. Reduce order count or increase size.',
    );
  });

  it('formats scale min notional errors with zh translations', () => {
    expect(
      formatScaleOrderValidationError(
        zhIntl,
        { code: 'minNotionalTooSmall', legIndex: 0, minNotional: '10' },
        'Leg 1: notional must be at least $10',
      ),
    ).toBe('每笔分段委托金额至少为 $10。请减少委托笔数或增加数量。');
  });
});
