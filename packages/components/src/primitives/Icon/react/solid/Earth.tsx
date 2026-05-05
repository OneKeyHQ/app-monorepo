import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEarth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1.998 12 2 3h3l1-2-2.948-1.981-1.943-.124zm1.997-10a8 8 0 0 0-7.227 4.565L8.001 11l1.005-1.995L13 8l.943-3.762A8 8 0 0 0 12 4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEarth;
