import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPanoramaView = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23 6.014c0-1.376-1.335-2.303-2.604-1.931-5.754 1.686-11.038 1.686-16.792 0C2.335 3.71 1 4.638 1 6.014v11.971c0 1.38 1.343 2.307 2.613 1.93 5.723-1.699 11.051-1.699 16.774 0 1.27.377 2.613-.55 2.613-1.93V6.015Z" />
  </Svg>
);
export default SvgPanoramaView;
