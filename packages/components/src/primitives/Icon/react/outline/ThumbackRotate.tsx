import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbackRotate = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.755 4.17a1 1 0 0 0-1.602.26L12.8 7.137a3 3 0 0 1-1.92 1.56L5.622 10.08a1 1 0 0 0-.453 1.674l7.076 7.076a1 1 0 0 0 1.674-.453l1.384-5.257a3 3 0 0 1 1.56-1.92l2.708-1.354a1 1 0 0 0 .26-1.602L15.755 4.17ZM8 17.413l2.83 2.831c1.638 1.637 4.434.881 5.023-1.358l1.384-5.257a1 1 0 0 1 .52-.64l2.708-1.354a3 3 0 0 0 .78-4.805l-4.076-4.076a3 3 0 0 0-4.804.78L11.01 6.244a1 1 0 0 1-.64.52L5.113 8.146c-2.24.59-2.995 3.385-1.358 5.022L6.585 16l-3.292 3.293a1 1 0 1 0 1.414 1.414L8 17.414Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgThumbackRotate;
