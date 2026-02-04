import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlighRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1m-8.707 3.043a1 1 0 0 1 1.414 0l3.543 3.543a2 2 0 0 1 0 2.828l-3.543 3.543a1 1 0 0 1-1.414-1.414L14.836 13H3a1 1 0 1 1 0-2h11.836l-2.543-2.543a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlighRight;
