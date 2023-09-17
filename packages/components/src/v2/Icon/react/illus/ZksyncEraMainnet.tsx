import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgZksyncEraMainnet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M4.85 6.25v-2.1L1 7.825l3.85 4.025v-2.8l4.2-2.8h-4.2ZM15 8l-3.85-3.85v2.8l-4.2 2.8h4.2v2.1L15 8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZksyncEraMainnet;
