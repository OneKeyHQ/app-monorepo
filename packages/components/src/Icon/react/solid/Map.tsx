import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m12 1.586-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 0 0 2 4v10a1 1 0 0 0 .293.707L6 18.414V5.586L3.707 3.293zm14 2L14 1.586v12.828l2.293 2.293A1 1 0 0 0 18 16V6a1 1 0 0 0-.293-.707z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMap;
