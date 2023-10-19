import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgCameraLomo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 17V7a2 2 0 0 0-2-2h-8.914c-.375 0-.735-.149-1-.414A2 2 0 0 0 7.672 4H6.328a2 2 0 0 0-1.414.586l-.414.477A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <Circle cx={7} cy={9} r={1} fill="currentColor" />
  </Svg>
);
export default SvgCameraLomo;
