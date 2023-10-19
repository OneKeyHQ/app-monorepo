import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageMountain = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.5 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-2.61 2.975l.024.025H6a3 3 0 0 1-3-3V6Zm13.414 13-6.293-6.293a3 3 0 0 0-4.242 0L5 13.586V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-1.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageMountain;
