import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLoader = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21v-3a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0m-3.95-5.465a1 1 0 0 1 1.415 1.415l-2.121 2.121a1 1 0 0 1-1.414-1.414zm8.486 0a1 1 0 0 1 1.414 0l2.121 2.122a1 1 0 0 1-1.414 1.414l-2.12-2.12a1 1 0 0 1 0-1.416ZM6 11.001a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2zm15 0a1 1 0 1 1 0 2h-3a1 1 0 0 1 0-2zM4.93 4.929a1 1 0 0 1 1.414 0l2.12 2.12a1.001 1.001 0 0 1-1.413 1.416L4.93 6.343a1 1 0 0 1 0-1.414m12.727 0a1 1 0 0 1 1.414 1.414l-2.12 2.122a1 1 0 0 1-1.415-1.415zM11 6V3a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgLoader;
