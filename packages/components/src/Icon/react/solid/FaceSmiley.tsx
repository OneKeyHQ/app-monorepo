import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceSmiley = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7.5-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-9.435 3.847a1 1 0 1 0-1.977.306 7.502 7.502 0 0 0 14.824 0 1 1 0 0 0-1.977-.306 5.501 5.501 0 0 1-10.87 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceSmiley;
