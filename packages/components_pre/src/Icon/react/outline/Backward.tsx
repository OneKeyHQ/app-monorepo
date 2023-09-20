import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBackward = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953l7.108-4.062A1.125 1.125 0 0 1 21 8.688v8.123zm-9.75 0c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 0 1 0-1.953L9.567 7.71a1.125 1.125 0 0 1 1.683.977v8.123z"
    />
  </Svg>
);
export default SvgBackward;
