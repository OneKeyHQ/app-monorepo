import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLoop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2a1 1 0 1 1 0 2H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4.586l1.293 1.293a1 1 0 0 1-1.414 1.414l-3-3a1 1 0 0 1 0-1.414l3-3a1 1 0 0 1 1.414 1.414L14.414 17H19a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLoop;
