import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m5.625 11.04 4.293-4.294a1 1 0 1 0-1.414-1.414L3.918 9.918a3 3 0 0 0 0 4.243l4.586 4.585a1 1 0 0 0 1.414-1.414L5.625 13.04h14.336a1 1 0 0 0 0-2H5.625Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowLeft;
