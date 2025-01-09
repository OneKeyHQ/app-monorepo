import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCirclePlaceholderOn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Z"
    />
  </Svg>
);
export default SvgCirclePlaceholderOn;
