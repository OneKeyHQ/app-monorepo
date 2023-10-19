import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrossedSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.293 7.293a1 1 0 0 1 1.414 0L12 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414L13.414 12l3.293 3.293a1 1 0 0 1-1.414 1.414L12 13.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L10.586 12 7.293 8.707a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrossedSmall;
