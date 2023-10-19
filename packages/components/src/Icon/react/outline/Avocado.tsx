import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAvocado = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M12.75 14.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="m5.024 19.008.006.005c2.809 2.814 7.54 2.557 10.266-.256 1.85-1.91 3.73-4.917 4.803-7.795.537-1.438.872-2.845.899-4.065.027-1.222-.253-2.255-.945-2.949-.692-.692-1.723-.973-2.942-.946-1.218.027-2.623.362-4.06.9-2.874 1.075-5.88 2.963-7.79 4.825-2.85 2.779-3.09 7.51-.242 10.275l.005.006Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAvocado;
