import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQuestionmark = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 15h2v-2h-2zM9 7v3h2V9h2v1l-2 1.5V14h2v-1.5l2-1.5V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQuestionmark;
