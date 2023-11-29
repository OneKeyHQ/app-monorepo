import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageWave = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3h11.99c1.66 0 3 1.34 3 3v12c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3Zm12 2H6c-.55 0-1 .45-1 1v6.22l1.27-.95.02-.02a2.99 2.99 0 0 1 3.86.45c1.47 1.58 2.94 2.75 4.85 2.75 1.7 0 2.86-.56 4-1.62V6c0-.55-.45-1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageWave;
