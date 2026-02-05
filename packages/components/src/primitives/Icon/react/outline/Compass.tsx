import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.883 2.468c1.022-.144 1.901.82 1.605 1.855L17.971 16.63a1.95 1.95 0 0 1-1.342 1.342L4.323 21.488a1.465 1.465 0 0 1-1.811-1.811L6.028 7.37A1.96 1.96 0 0 1 7.37 6.028l12.307-3.516zM7.906 7.906 4.63 19.367l11.462-3.274 3.274-11.462zm5.07 4.093a.977.977 0 1 0-1.953 0 .977.977 0 0 0 1.953 0m1.954 0a2.93 2.93 0 1 1-5.86 0 2.93 2.93 0 0 1 5.86 0" />
  </Svg>
);
export default SvgCompass;
