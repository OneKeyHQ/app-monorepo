import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgLightningBolt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLightningBolt;
