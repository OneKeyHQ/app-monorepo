import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClouds = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.36 6.132A7 7 0 1 0 9 20h7.5a5.5 5.5 0 0 0 3.102-10.042 5 5 0 1 0-9.241-3.825Zm1.89.667a7 7 0 0 1 2.508 2.22c.07.1.248.183.431.138a5.5 5.5 0 0 1 2.584-.009 3 3 0 0 0-5.523-2.35ZM9 8a5 5 0 0 0 0 10h7.5a3.5 3.5 0 1 0-.836-6.9c-.921.226-1.972-.108-2.55-.943A4.99 4.99 0 0 0 9 8"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClouds;
