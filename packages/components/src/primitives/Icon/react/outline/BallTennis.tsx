import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallTennis = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c2.56 0 4.898.964 6.667 2.547A9.98 9.98 0 0 1 22 12a9.98 9.98 0 0 1-3.333 7.453A9.97 9.97 0 0 1 12 22a9.97 9.97 0 0 1-6.667-2.547A9.98 9.98 0 0 1 2 12a9.98 9.98 0 0 1 3.333-7.453A9.97 9.97 0 0 1 12 2m0 2c-1.67 0-3.22.51-4.503 1.386A9.96 9.96 0 0 1 10 12a9.96 9.96 0 0 1-2.503 6.613A7.96 7.96 0 0 0 12 20c1.67 0 3.22-.512 4.502-1.387A9.96 9.96 0 0 1 14 12c0-2.536.947-4.852 2.502-6.614A7.96 7.96 0 0 0 12 4M6 6.712A7.96 7.96 0 0 0 4 12c0 2.028.756 3.877 2 5.287 1.244-1.41 2-3.26 2-5.287a7.96 7.96 0 0 0-2-5.288m12 0A7.96 7.96 0 0 0 16 12c0 2.028.756 3.877 2 5.287 1.244-1.41 2-3.26 2-5.287a7.96 7.96 0 0 0-2-5.288"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBallTennis;
