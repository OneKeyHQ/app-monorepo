import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMic = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"
    />
    <Path
      fill="currentColor"
      d="M5.853 14.456a1 1 0 0 0-1.678 1.088C5.3 17.276 7.446 19.578 11 19.95V21a1 1 0 0 0 2 0v-1.051c3.553-.37 5.7-2.673 6.825-4.405a1 1 0 0 0-1.678-1.088C17.107 16.058 15.2 18 12 18s-5.107-1.942-6.147-3.544Z"
    />
  </Svg>
);
export default SvgMic;
