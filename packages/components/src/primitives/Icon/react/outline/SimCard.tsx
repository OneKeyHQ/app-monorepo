import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 20V4a2 2 0 0 1 2-2h7.172l.296.015a3 3 0 0 1 1.825.864l3.828 3.828A3 3 0 0 1 20 8.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2m6-7v3h4v-3zm6 3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2zM6 20h12V8.828a1 1 0 0 0-.293-.707l-3.828-3.828a1 1 0 0 0-.608-.288L13.17 4H6z" />
  </Svg>
);
export default SvgSimCard;
