import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgExpand = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 4a1 1 0 0 1 1-1h5a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0V6.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L17.586 5H14a1 1 0 0 1-1-1Zm-9 9a1 1 0 0 1 1 1v3.586l4.293-4.293a1 1 0 0 1 1.414 1.414L6.414 19H10a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-5a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgExpand;
