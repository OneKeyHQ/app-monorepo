import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFlag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15V4a1 1 0 0 1 1-1h13.131a1 1 0 0 1 .832 1.555l-2.593 3.89a1 1 0 0 0 0 1.11l2.593 3.89A1 1 0 0 1 19.131 15H5Zm0 0v6"
    />
  </Svg>
);
export default SvgFlag;
