import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 14c0-1.929-1.018-4.013-2.361-5.89C14.344 6.3 12.842 4.813 12 4.036c-.842.777-2.344 2.262-3.639 4.072C7.018 9.987 6.001 12.071 6 14a6 6 0 0 0 12 0m2 0a8 8 0 1 1-16 0c0-2.563 1.317-5.07 2.735-7.054 1.438-2.01 3.089-3.628 3.97-4.435l.143-.12a1.91 1.91 0 0 1 2.447.12c.881.807 2.532 2.426 3.97 4.435C18.683 8.93 20 11.436 20 14" />
  </Svg>
);
export default SvgDrop;
