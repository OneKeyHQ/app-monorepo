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
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2m-1 5a2 2 0 0 0-2 2v.5a1 1 0 1 0 2 0V9h2v1l-1.2.9a2 2 0 0 0-.8 1.6v.5a1 1 0 1 0 2 0v-.5l1.2-.9A2 2 0 0 0 15 10V9a2 2 0 0 0-2-2zm2 9a1 1 0 1 0-2 0v.01a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQuestionmark;
