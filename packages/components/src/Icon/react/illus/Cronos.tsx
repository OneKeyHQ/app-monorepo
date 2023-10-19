import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCronos = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M3.2 10.985V5.15l5.055-2.918 5.056 2.918v5.836l-5.056 2.918L3.2 10.985Z"
      stroke="#8C8CA1"
      strokeWidth={0.4}
    />
    <Path
      d="M10.304 4.621H6.18L5.7 6.723h5.11l-.506-2.102Zm-3.393 4.99V8.212l-1.224-.771-1.383 1.024 1.889 3.287h.758l.892-.839v-.412L6.91 9.61Z"
      fill="#8C8CA1"
    />
    <Path
      d="M9.586 7.042H6.925l.439 1.171-.133 1.318H9.28l-.133-1.318.439-1.17Z"
      fill="#8C8CA1"
    />
    <Path
      d="m10.81 7.428-1.21.785V9.61l-.919.892v.412l.892.825h.745l1.876-3.273-1.384-1.038Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgCronos;
