import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUndo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.207 5.707a1 1 0 0 0-1.414-1.414L2.5 7.586a2 2 0 0 0 0 2.828l3.293 3.293a1 1 0 0 0 1.414-1.414L4.914 10H17a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-5a1 1 0 1 0 0 2h5a5 5 0 0 0 5-5v-1a5 5 0 0 0-5-5H4.914l2.293-2.293Z"
    />
  </Svg>
);
export default SvgUndo;
