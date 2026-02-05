import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSend = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.859 4.876c-.37-1.254.93-2.347 2.102-1.77l15.317 7.549c1.116.55 1.116 2.14 0 2.69L4.961 20.894c-1.172.578-2.471-.515-2.102-1.768L4.66 13h4.336a1 1 0 1 0 0-2H4.66z" />
  </Svg>
);
export default SvgSend;
