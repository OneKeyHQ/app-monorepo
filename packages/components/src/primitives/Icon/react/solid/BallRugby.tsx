import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.5 21.914Q9.761 22 9 22H4a2 2 0 0 1-2-2v-5q.001-.761.086-1.5z" />
    <Path
      fillRule="evenodd"
      d="M21.425 12.838a13.03 13.03 0 0 1-8.586 8.586L2.576 11.162a13.03 13.03 0 0 1 8.586-8.586zm-12.59.912 1.415 1.414 4.914-4.914-1.414-1.414z"
      clipRule="evenodd"
    />
    <Path d="M20 2a2 2 0 0 1 2 2v5q0 .761-.085 1.5L13.5 2.086A13 13 0 0 1 15 2z" />
  </Svg>
);
export default SvgBallRugby;
