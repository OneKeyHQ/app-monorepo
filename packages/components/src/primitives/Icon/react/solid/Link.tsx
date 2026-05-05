import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.414 11-3.5 3.5L9.5 20.086l3.5-3.5L14.414 18 9.5 22.914 1.086 14.5 6 9.586z" />
    <Path d="M16.414 9 9 16.414 7.586 15 15 7.586z" />
    <Path d="M22.914 9.5 18 14.414 16.586 13l3.5-3.5L14.5 3.914l-3.5 3.5L9.586 6 14.5 1.086z" />
  </Svg>
);
export default SvgLink;
