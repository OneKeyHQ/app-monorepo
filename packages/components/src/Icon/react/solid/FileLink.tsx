import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2H7a3 3 0 0 0-3 3v4.341A6 6 0 0 1 12 15v3a5.978 5.978 0 0 1-1.528 4H17a3 3 0 0 0 3-3v-9h-5a3 3 0 0 1-3-3V2Z"
    />
    <Path
      fill="currentColor"
      d="M19.414 8 14 2.586V7a1 1 0 0 0 1 1h4.414ZM4 15a2 2 0 1 1 4 0 1 1 0 1 0 2 0 4 4 0 0 0-8 0 1 1 0 1 0 2 0Z"
    />
    <Path fill="currentColor" d="M7 16a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Z" />
    <Path
      fill="currentColor"
      d="M4 18a1 1 0 1 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0Z"
    />
  </Svg>
);
export default SvgFileLink;
