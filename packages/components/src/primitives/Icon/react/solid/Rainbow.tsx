import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRainbow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.998 8c-5.216 0-9.5 3.994-9.959 9.09a1 1 0 0 1-1.992-.18C.598 10.793 5.738 6 11.998 6c6.26 0 11.4 4.793 11.951 10.91a1 1 0 1 1-1.992.18C21.498 11.994 17.214 8 11.998 8Zm0 4a6.002 6.002 0 0 0-5.939 5.142 1 1 0 0 1-1.98-.284 8.002 8.002 0 0 1 15.838 0 1 1 0 0 1-1.98.284A6.002 6.002 0 0 0 11.998 12Zm0 4a2 2 0 0 0-1.886 1.333 1 1 0 1 1-1.886-.666 4.001 4.001 0 0 1 7.544 0 1 1 0 1 1-1.885.666A2.001 2.001 0 0 0 11.998 16Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRainbow;
