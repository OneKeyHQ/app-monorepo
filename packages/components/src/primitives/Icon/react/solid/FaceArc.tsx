import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceArc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M8 16.15h8v-1.8H8zM9.25 7.5c-.828 0-1.5.796-1.5 1.9 0 1.105.672 1.85 1.5 1.85s1.5-.745 1.5-1.85-.672-1.9-1.5-1.9m5.5 0c-.828 0-1.5.796-1.5 1.9 0 1.105.672 1.85 1.5 1.85s1.5-.745 1.5-1.85-.672-1.9-1.5-1.9"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceArc;
