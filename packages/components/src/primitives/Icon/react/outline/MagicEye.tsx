import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicEye = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 6c-3.127 0-6.367 1.79-8.638 5.606a.77.77 0 0 0 0 .788C5.633 16.209 8.873 18 12 18s6.367-1.79 8.638-5.606a.77.77 0 0 0 0-.788C18.367 7.791 15.127 6 12 6Zm0-2c3.952 0 7.79 2.272 10.357 6.583a2.77 2.77 0 0 1 0 2.834C19.79 17.727 15.952 20 12 20c-3.952 0-7.79-2.272-10.357-6.583a2.771 2.771 0 0 1 0-2.834C4.21 6.273 8.048 4 12 4Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m10.741 10.518.812-1.624a.5.5 0 0 1 .894 0l.812 1.624a.5.5 0 0 0 .223.223l1.624.812a.5.5 0 0 1 0 .894l-1.624.812a.5.5 0 0 0-.223.223l-.812 1.624a.5.5 0 0 1-.894 0l-.812-1.624a.5.5 0 0 0-.223-.223l-1.624-.812a.5.5 0 0 1 0-.894l1.624-.812a.5.5 0 0 0 .223-.223Z"
    />
  </Svg>
);
export default SvgMagicEye;
