import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDesktopComputer = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.22l.123.489.804.804A1 1 0 0 1 13 18H7a1 1 0 0 1-.707-1.707l.804-.804L7.22 15H5a2 2 0 0 1-2-2V5zm5.771 7H5V5h10v7H8.771z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDesktopComputer;
