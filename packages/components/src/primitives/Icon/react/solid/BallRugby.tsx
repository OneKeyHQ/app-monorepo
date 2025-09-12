import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.162 2.576a13.03 13.03 0 0 0-8.586 8.586l10.262 10.262a13.03 13.03 0 0 0 8.586-8.586zm3.295 8.381a1 1 0 0 0-1.414-1.414l-3.5 3.5a1 1 0 1 0 1.414 1.414z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M2 15q.001-.761.086-1.5l8.414 8.414Q9.761 22 9 22H4a2 2 0 0 1-2-2zm19.914-4.5Q22 9.761 22 9V4a2 2 0 0 0-2-2h-5q-.761.001-1.5.086z"
    />
  </Svg>
);
export default SvgBallRugby;
