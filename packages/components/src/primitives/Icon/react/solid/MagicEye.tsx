import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicEye = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22.357 10.583C19.791 6.273 15.952 4 12 4 8.05 4 4.21 6.272 1.644 10.583a2.77 2.77 0 0 0 0 2.834C4.21 17.727 8.049 20 12 20c3.952 0 7.79-2.272 10.357-6.583a2.77 2.77 0 0 0 0-2.834ZM11.553 8.894l-.812 1.624a.5.5 0 0 1-.223.223l-1.624.812a.5.5 0 0 0 0 .894l1.624.812a.5.5 0 0 1 .223.223l.812 1.624a.5.5 0 0 0 .894 0l.812-1.624a.5.5 0 0 1 .223-.223l1.624-.812a.5.5 0 0 0 0-.894l-1.624-.812a.5.5 0 0 1-.223-.223l-.812-1.624a.5.5 0 0 0-.894 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicEye;
