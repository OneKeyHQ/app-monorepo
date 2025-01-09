import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.707 7.293a1 1 0 0 1 0 1.414L7.414 12l3.293 3.293a1 1 0 0 1-1.414 1.414L6 13.414a2 2 0 0 1 0-2.828l3.293-3.293a1 1 0 0 1 1.414 0Zm7 0a1 1 0 0 1 0 1.414L14.414 12l3.293 3.293a1 1 0 0 1-1.414 1.414L13 13.414a2 2 0 0 1 0-2.828l3.293-3.293a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleLeft;
