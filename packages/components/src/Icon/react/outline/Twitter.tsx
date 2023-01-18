import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTwitter = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      d="m22 7.268-1.88-.806.985-2.149-2.29.761A3.999 3.999 0 0 0 16.13 4a4.035 4.035 0 0 0-4.027 4.028v.896c-3.168.653-5.933-1.075-8.501-4.029-.448 2.387 0 4.178 1.342 5.372L2 9.819a4.073 4.073 0 0 0 3.803 3.58l-2.46.896c.894 1.79 2.523 2.068 4.697 2.238A10.305 10.305 0 0 1 2 18.323c11.418 5.076 18.12-2.38 18.12-8.952v-.743L22 7.268Z"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgTwitter;
