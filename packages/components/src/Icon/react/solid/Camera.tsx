import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.074 4.336A3 3 0 0 1 10.57 3h2.86a3 3 0 0 1 2.496 1.336l.812 1.219A1 1 0 0 0 17.57 6H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h1.43a1 1 0 0 0 .832-.445l.812-1.22ZM12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCamera;
