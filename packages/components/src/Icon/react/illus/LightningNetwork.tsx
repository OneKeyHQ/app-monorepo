import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgLightningNetwork = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="M9.24 2.667c-.477 1.238-.954 2.57-1.526 3.904 0 0 0 .19.19.19h3.912s0 .096.095.191l-5.723 6.381c-.096-.095-.096-.19-.096-.286l2.003-4.285V8.38H4.09V8l4.865-5.333h.286Z"
    />
  </Svg>
);
export default SvgLightningNetwork;
