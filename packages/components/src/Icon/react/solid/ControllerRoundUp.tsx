import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 2Zm-1.75 3.75a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M2 12a3.75 3.75 0 1 1 7.5 0A3.75 3.75 0 0 1 2 12Zm12.5 0a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Zm-6.25 6.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z"
    />
  </Svg>
);
export default SvgControllerRoundUp;
