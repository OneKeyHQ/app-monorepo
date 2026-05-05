import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBunnyHat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 13h-2v9H4v-9H2v-2h20zM6.958.209C9.54 3.029 10.7 6.146 11 10H6c-1-4-.42-6.662.958-9.791M13 10c.065-2.502.549-8.296 4.497-7.081 2.148.66 3.683 2.83 4.905 4.59l.25.358L18 7.5c.007.02.497 1.507 0 2.5z" />
  </Svg>
);
export default SvgBunnyHat;
