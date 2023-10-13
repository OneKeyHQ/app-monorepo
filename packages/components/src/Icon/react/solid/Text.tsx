import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2h-7v15a1 1 0 1 1-2 0V5H4a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgText;
