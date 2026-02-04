import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.295 2.51a1.91 1.91 0 0 0-2.59 0c-.881.808-2.532 2.426-3.97 4.436C5.316 8.93 4 11.437 4 14.001a8 8 0 1 0 16 0c0-2.564-1.316-5.072-2.735-7.055-1.438-2.01-3.089-3.628-3.97-4.436" />
  </Svg>
);
export default SvgDrop;
