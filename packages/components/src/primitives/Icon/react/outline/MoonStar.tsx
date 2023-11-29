import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMoonStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.093 2.53a1 1 0 0 1-.041 1.07 6 6 0 0 0 8.345 8.344 1 1 0 0 1 1.563.908c-.434 5.122-4.728 9.144-9.962 9.144C6.476 21.996 2 17.52 2 11.998c0-5.234 4.021-9.528 9.144-9.962a1 1 0 0 1 .95.494ZM9.42 4.424a7.998 7.998 0 1 0 10.152 10.152A8 8 0 0 1 9.42 4.424Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m16.237 5.017.812-1.623a.5.5 0 0 1 .894 0l.812 1.623a.5.5 0 0 0 .224.224l1.623.812a.5.5 0 0 1 0 .894l-1.623.812a.5.5 0 0 0-.224.223l-.812 1.623a.5.5 0 0 1-.894 0l-.812-1.623a.5.5 0 0 0-.223-.223l-1.623-.812a.5.5 0 0 1 0-.894l1.623-.812a.5.5 0 0 0 .223-.224Z"
    />
  </Svg>
);
export default SvgMoonStar;
