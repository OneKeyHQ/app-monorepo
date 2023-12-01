import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4c3.952 0 7.79 2.272 10.357 6.583a2.77 2.77 0 0 1 0 2.834C19.79 17.727 15.952 20 12 20c-3.952 0-7.79-2.272-10.357-6.583a2.771 2.771 0 0 1 0-2.834C4.21 6.273 8.048 4 12 4Zm-3.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
