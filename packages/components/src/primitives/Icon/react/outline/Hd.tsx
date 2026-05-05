import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.152 11.135h2.48v-2.68h2.071V15.5h-2.07v-2.725h-2.48V15.5H5.081V8.454h2.07v2.68Z" />
    <Path
      fillRule="evenodd"
      d="M15.692 8.454c2.134 0 3.394 1.211 3.394 3.462v.01c0 2.256-1.26 3.574-3.394 3.574H12.68V8.454zm-.942 5.4h.65c1.035 0 1.577-.63 1.577-1.928v-.01c0-1.182-.591-1.816-1.578-1.816h-.649v3.755Z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHd;
