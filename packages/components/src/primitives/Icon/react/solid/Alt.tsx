import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.28 12.568H7.133l.555-2.13h.034l.556 2.13Z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4.647 15h1.851l.312-1.191h1.793L8.914 15h1.85L8.81 9.01H6.602zm6.488 0h4.108v-1.395h-2.348V9.011h-1.76zm3.242-4.595h1.577V15h1.76v-4.595h1.577V9.011h-4.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlt;
