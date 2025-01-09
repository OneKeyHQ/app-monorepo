import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlayCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 14.804V9.196a.5.5 0 0 1 .782-.413l4.112 2.804a.5.5 0 0 1 0 .826l-4.112 2.804a.5.5 0 0 1-.782-.413Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlayCircle;
