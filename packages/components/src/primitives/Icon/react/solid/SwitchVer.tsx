import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitchVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.586 3.5a2 2 0 0 1 2.828 0l3.293 3.293a1 1 0 0 1-1.414 1.414L8 5.914V20a1 1 0 1 1-2 0V5.914L3.707 8.207a1 1 0 0 1-1.414-1.414L5.586 3.5l.707.707-.707-.707ZM17 3a1 1 0 0 1 1 1v14.086l2.293-2.293a1 1 0 0 1 1.414 1.414L18.414 20.5a2 2 0 0 1-2.828 0l-3.293-3.293a1 1 0 0 1 1.414-1.414L16 18.086V4a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwitchVer;
