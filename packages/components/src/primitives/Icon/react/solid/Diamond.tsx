import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDiamond = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.904 3.02c-.532 0-1.042.211-1.418.587L1.474 8.62a2.005 2.005 0 0 0 0 2.836l9.108 9.108a2.005 2.005 0 0 0 2.836 0l9.109-9.108a2.005 2.005 0 0 0 0-2.836l-5.013-5.013a2 2 0 0 0-1.418-.587zm2.299 5.722a1.003 1.003 0 0 0-1.418-1.418L6.78 9.329a1.003 1.003 0 0 0 0 1.418l2.005 2.005a1.003 1.003 0 0 0 1.418-1.418l-1.296-1.296z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDiamond;
