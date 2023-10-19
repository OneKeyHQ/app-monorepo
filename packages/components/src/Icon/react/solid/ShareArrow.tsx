import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShareArrow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 4.744c0-1.537 1.839-2.327 2.954-1.27l7.66 7.256a1.75 1.75 0 0 1 0 2.54l-7.66 7.257c-1.115 1.056-2.953.266-2.953-1.27v-2.75c-3.418.055-5.326.393-6.513.933-1.196.545-1.733 1.325-2.406 2.637-.558 1.089-2.09.584-2.08-.515.044-4.131.7-7.246 2.68-9.287 1.83-1.886 4.589-2.65 8.319-2.76V4.743Z"
    />
  </Svg>
);
export default SvgShareArrow;
