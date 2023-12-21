import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 12a7 7 0 0 1 7-7h8a7 7 0 1 1 0 14H8a7 7 0 0 1-7-7Zm11.5 0a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwitch;
