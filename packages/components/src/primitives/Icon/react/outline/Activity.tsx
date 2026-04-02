import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgActivity = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 17.15 17.307 11H23v2h-4.307L15 22.848l-6-16L6.693 13H1v-2h4.307L9 1.152z" />
  </Svg>
);
export default SvgActivity;
