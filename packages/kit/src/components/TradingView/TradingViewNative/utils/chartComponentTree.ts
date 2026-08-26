import { formatTradingViewNativePriceTick } from './chartLayout';

import type {
  ITradingViewNativeChartComponentNode,
  ITradingViewNativeChartLeafComponent,
} from '../types';

export function flattenTradingViewNativeChartComponentTree(
  components: readonly ITradingViewNativeChartComponentNode[],
): ITradingViewNativeChartLeafComponent[] {
  const flattenedComponents: ITradingViewNativeChartLeafComponent[] = [];
  const pendingComponents = components.toReversed();

  while (pendingComponents.length > 0) {
    const component = pendingComponents.pop();
    if (component) {
      if (component.type === 'group') {
        for (
          let index = component.children.length - 1;
          index >= 0;
          index -= 1
        ) {
          const child = component.children[index];
          if (child) {
            pendingComponents.push(child);
          }
        }
      } else {
        flattenedComponents.push(component);
      }
    }
  }

  return flattenedComponents;
}

export function getTradingViewNativeChartComponentPriceAxisLabel(
  components: readonly ITradingViewNativeChartLeafComponent[],
) {
  'worklet';

  let widestLabel = '';
  for (const component of components) {
    if (
      component.type === 'referenceLine' &&
      Number.isFinite(component.props.anchor.price)
    ) {
      const label = formatTradingViewNativePriceTick(
        component.props.anchor.price,
      );
      if (label.length > widestLabel.length) {
        widestLabel = label;
      }
    }
  }
  return widestLabel;
}
