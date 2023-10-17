import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceId = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 4H6a2 2 0 0 0-2 2v2m0 8v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2M12.5 8.75V11a2 2 0 0 1-1.5 1.937M8 9v1m8-1v1m-7 5.697c.883.51 1.907.803 3 .803a5.972 5.972 0 0 0 3-.803"
    />
  </Svg>
);
export default SvgFaceId;
