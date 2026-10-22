import { NumberSizeableText } from '@onekeyhq/components';
import type { INumberSizeableTextProps } from '@onekeyhq/components/src/content/NumberSizeableText';

import { getEarnPortfolioValueDisplay } from '../hooks/earnPortfolioValue';

/**
 * 在各端统一展示当前已知金额，赎回请求同步状态不改变金额前缀。
 * @param props 已知金额及原有格式、样式和隐藏设置；无效数展示 --。
 * @returns 格式化后的金额，隐藏金额时沿用数字组件的隐私展示。
 */
export function EarnPortfolioValue({
  children,
  ...props
}: INumberSizeableTextProps) {
  return (
    <NumberSizeableText {...props}>
      {getEarnPortfolioValueDisplay(children)}
    </NumberSizeableText>
  );
}
