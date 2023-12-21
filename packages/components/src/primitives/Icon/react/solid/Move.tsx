import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMove = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.414 2.5a2 2 0 0 0-2.828 0L8.293 4.793a1 1 0 0 0 1.414 1.414L11 4.914V11H4.914l1.293-1.293a1 1 0 0 0-1.414-1.414L2.5 10.586a2 2 0 0 0 0 2.828l2.293 2.293a1 1 0 0 0 1.414-1.414L4.914 13H11v6.086l-1.293-1.293a1 1 0 0 0-1.414 1.414l2.293 2.293a2 2 0 0 0 2.828 0l2.293-2.293a1 1 0 0 0-1.414-1.414L13 19.086V13h6.085l-1.292 1.293a1 1 0 0 0 1.414 1.414l2.293-2.293a2 2 0 0 0 0-2.828l-2.293-2.293a1 1 0 0 0-1.414 1.414L19.086 11H13V4.914l1.293 1.293a1 1 0 0 0 1.414-1.414L13.414 2.5Z"
    />
  </Svg>
);
export default SvgMove;
