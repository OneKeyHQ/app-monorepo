import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronTopSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.586 10a2 2 0 0 1 2.828 0l3.293 3.293a1 1 0 0 1-1.414 1.414L12 11.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L10.586 10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronTopSmall;
