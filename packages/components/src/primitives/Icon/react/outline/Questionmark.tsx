import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQuestionmark = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 4.01V16a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0M11 13v-.5a2 2 0 0 1 .8-1.6L13 10V9h-2v.5a1 1 0 1 1-2 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a2 2 0 0 1-.8 1.6l-1.2.9v.5a1 1 0 1 1-2 0m11-1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgQuestionmark;
