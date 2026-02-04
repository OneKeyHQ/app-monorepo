import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSend = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.858 4.876c-.357-1.214.851-2.278 1.993-1.819l.11.05 15.317 7.548c1.116.55 1.116 2.14 0 2.69L4.961 20.893c-1.172.578-2.471-.515-2.103-1.768L4.953 12zM6.745 11h2.252a1 1 0 0 1 0 2H6.745L5.1 18.596 18.483 12 5.1 5.404z" />
  </Svg>
);
export default SvgSend;
