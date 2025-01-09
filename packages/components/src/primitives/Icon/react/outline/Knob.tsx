import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgKnob = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.536 15.532a5.027 5.027 0 0 0 0-7.094c-1.913-1.917-5.162-1.917-7.071 0a5.027 5.027 0 0 0 0 7.094 4.99 4.99 0 0 0 7.07 0Zm0 0-.68-.675-2.142-2.143M20 7.2v9.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C18.48 20 17.92 20 16.8 20H7.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C4 18.48 4 17.92 4 16.8V7.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C5.52 4 6.08 4 7.2 4h9.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C20 5.52 20 6.08 20 7.2Z"
    />
  </Svg>
);
export default SvgKnob;
