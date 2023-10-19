import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMoonStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m16.24 5.018.812-1.624a.5.5 0 0 1 .894 0l.812 1.624a.5.5 0 0 0 .224.223l1.623.812a.5.5 0 0 1 0 .894l-1.623.812a.5.5 0 0 0-.224.223l-.812 1.624a.5.5 0 0 1-.894 0l-.812-1.624a.5.5 0 0 0-.223-.223l-1.623-.812a.5.5 0 0 1 0-.894l1.623-.812a.5.5 0 0 0 .223-.223Z"
    />
    <Path
      fill="currentColor"
      d="M12.052 3.6a1 1 0 0 0-.908-1.564C6.02 2.47 2 6.764 2 11.998c0 5.522 4.476 9.998 9.998 9.998 5.234 0 9.528-4.021 9.962-9.144a1 1 0 0 0-1.564-.908A6 6 0 0 1 12.051 3.6Z"
    />
  </Svg>
);
export default SvgMoonStar;
