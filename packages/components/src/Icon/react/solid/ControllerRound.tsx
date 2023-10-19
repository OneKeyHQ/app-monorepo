import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 2ZM5.75 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm12.5 0a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM12 14.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
    />
  </Svg>
);
export default SvgControllerRound;
