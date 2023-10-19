import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 7.204C4 5.486 6.024 4.567 7.317 5.7L12 9.797V7.204c0-1.718 2.024-2.637 3.317-1.505l5.481 4.796a2 2 0 0 1 0 3.01l-5.481 4.797C14.024 19.433 12 18.515 12 16.797v-2.593l-4.683 4.098C6.024 19.433 4 18.515 4 16.797V7.204Z"
    />
  </Svg>
);
export default SvgForward;
