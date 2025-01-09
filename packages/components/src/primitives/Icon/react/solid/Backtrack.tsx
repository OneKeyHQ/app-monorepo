import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBacktrack = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.16 4a3 3 0 0 0-2.605 1.512l-2.857 5a3 3 0 0 0 0 2.976l2.857 5A3 3 0 0 0 7.16 20H19a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7.16Zm4.547 5.293a1 1 0 1 0-1.414 1.414L11.586 12l-1.293 1.293a1 1 0 1 0 1.414 1.414L13 13.414l1.293 1.293a1 1 0 0 0 1.414-1.414L14.414 12l1.293-1.293a1 1 0 0 0-1.414-1.414L13 10.586l-1.293-1.293Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBacktrack;
