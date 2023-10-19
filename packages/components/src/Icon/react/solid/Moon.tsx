import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMoon = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.056 3.6a1 1 0 0 0-.908-1.564c-5.123.434-9.144 4.728-9.144 9.962 0 5.522 4.476 9.998 9.998 9.998 5.234 0 9.528-4.021 9.962-9.144a1 1 0 0 0-1.564-.908A6 6 0 0 1 12.055 3.6Z"
    />
  </Svg>
);
export default SvgMoon;
