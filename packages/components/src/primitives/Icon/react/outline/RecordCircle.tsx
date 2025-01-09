import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRecordCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
  </Svg>
);
export default SvgRecordCircle;
