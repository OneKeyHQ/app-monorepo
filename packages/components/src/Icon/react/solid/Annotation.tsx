import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnnotation = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 13V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3l3 3 3-3h3a2 2 0 0 0 2-2zM5 7a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnnotation;
