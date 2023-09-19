import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgReceiptPercent = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 1.5c-1.921 0-3.816.111-5.68.327-1.497.174-2.57 1.46-2.57 2.93V21.75a.75.75 0 0 0 1.029.696l3.471-1.388 3.472 1.388a.75.75 0 0 0 .556 0l3.472-1.388 3.471 1.388a.75.75 0 0 0 1.029-.696V4.757c0-1.47-1.073-2.756-2.57-2.93A49.255 49.255 0 0 0 12 1.5zm3.53 7.28a.75.75 0 0 0-1.06-1.06l-6 6a.75.75 0 1 0 1.06 1.06l6-6zM8.625 9a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0zm5.625 3.375a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptPercent;
