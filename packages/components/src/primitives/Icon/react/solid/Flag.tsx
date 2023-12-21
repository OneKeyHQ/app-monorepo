import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFlag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 2a2 2 0 0 0-2 2v17a1 1 0 1 0 2 0v-5h13.131c1.598 0 2.55-1.78 1.665-3.11L18.202 9l2.594-3.89C21.682 3.78 20.729 2 19.13 2H6Z"
    />
  </Svg>
);
export default SvgFlag;
