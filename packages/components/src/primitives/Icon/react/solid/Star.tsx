import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.373 1.862c-.553-1.15-2.193-1.15-2.745 0L8.264 6.78l-5.44.713c-1.262.165-1.787 1.723-.848 2.609l3.976 3.749-.998 5.353c-.237 1.27 1.109 2.212 2.22 1.613l4.825-2.6 4.825 2.6c1.111.6 2.457-.343 2.22-1.613l-.998-5.353 3.976-3.749c.939-.886.414-2.444-.848-2.61l-5.44-.712-2.362-4.917Z"
    />
  </Svg>
);
export default SvgStar;
