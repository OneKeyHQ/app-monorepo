import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitchHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15.793 2.293a1 1 0 0 1 1.414 0L20.5 5.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L18.086 8H4a1 1 0 0 1 0-2h14.086l-2.293-2.293a1 1 0 0 1 0-1.414Zm-7.586 10a1 1 0 0 1 0 1.414L5.914 16H20a1 1 0 1 1 0 2H5.914l2.293 2.293a1 1 0 1 1-1.414 1.414L3.5 18.414a2 2 0 0 1 0-2.828l3.293-3.293a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwitchHor;
