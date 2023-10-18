import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.486 13.204a2.769 2.769 0 0 0 2.971-4.533l-5.985-5.986a2.768 2.768 0 0 0-4.538 2.96L5.02 8.37a3 3 0 0 0-1.722 2.351L2.05 20.678l6.018-6.017A2.002 2.002 0 0 1 10 12.143a2 2 0 1 1-.518 3.932l-6.015 6.014 9.914-1.312a3 3 0 0 0 2.317-1.69l2.788-5.883Zm1.557-2.033c-.3.3-.786.3-1.086 0l-5.985-5.986A.768.768 0 0 1 14.058 4.1l5.985 5.986c.3.3.3.786 0 1.086Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPen;
