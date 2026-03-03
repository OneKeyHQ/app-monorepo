import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnimation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 9h-1.05c-.573 0-1.054.272-1.561.887-.532.645-.981 1.532-1.494 2.56-.486.972-1.035 2.085-1.74 2.94C10.424 16.272 9.428 17 8.05 17H7v-2h1.05c.573 0 1.054-.271 1.561-.886.532-.644.981-1.532 1.494-2.56.486-.972 1.035-2.085 1.74-2.94C13.576 7.73 14.572 7 15.95 7H17z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnimation;
