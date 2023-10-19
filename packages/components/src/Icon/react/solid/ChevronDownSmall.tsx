import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDownSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.586 14a2 2 0 0 0 2.828 0l3.293-3.293a1 1 0 0 0-1.414-1.414L12 12.586 8.707 9.293a1 1 0 0 0-1.414 1.414L10.586 14Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDownSmall;
