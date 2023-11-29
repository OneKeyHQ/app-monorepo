import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraLomo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.328 3a3 3 0 0 0-2.169.93l-.232.268A3 3 0 0 0 2 7v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-8.914a.414.414 0 0 1-.293-.121A3 3 0 0 0 7.672 3H6.328ZM10 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm-3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraLomo;
