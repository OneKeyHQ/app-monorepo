import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderDelete = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 6a3 3 0 0 1 3-3h3.93a3 3 0 0 1 2.496 1.336l.812 1.219A1 1 0 0 0 13.07 6H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9.83a3 3 0 0 0-.594-3A3 3 0 0 0 5 12.764a3.001 3.001 0 0 0-3-.593V6Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.707 14.293a1 1 0 0 1 0 1.414L6.414 17l1.293 1.293a1 1 0 1 1-1.414 1.414L5 18.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L3.586 17l-1.293-1.293a1 1 0 1 1 1.414-1.414L5 15.586l1.293-1.293a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderDelete;
