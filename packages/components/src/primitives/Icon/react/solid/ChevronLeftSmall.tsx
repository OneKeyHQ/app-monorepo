import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLeftSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.293 7.293a1 1 0 0 0-1.414 0l-3.293 3.293a2 2 0 0 0 0 2.828l3.293 3.293a1 1 0 0 0 1.414-1.414L11 12l3.293-3.293a1 1 0 0 0 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLeftSmall;
