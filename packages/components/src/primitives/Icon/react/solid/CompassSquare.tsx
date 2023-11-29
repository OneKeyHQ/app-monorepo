import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm11.524 2.248a1 1 0 0 1 1.228 1.228l-1.12 4.104a1.5 1.5 0 0 1-1.052 1.053l-4.104 1.12a1 1 0 0 1-1.228-1.229l1.12-4.104a1.5 1.5 0 0 1 1.052-1.053l4.104-1.12Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassSquare;
