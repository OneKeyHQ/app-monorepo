import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.03 4.72a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 11.69l6.97-6.97a.75.75 0 0 1 1.06 0zm0 6a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06L12 17.69l6.97-6.97a.75.75 0 0 1 1.06 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleDown;
