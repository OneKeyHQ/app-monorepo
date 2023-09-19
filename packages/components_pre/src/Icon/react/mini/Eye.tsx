import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    <Path
      fillRule="evenodd"
      d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
