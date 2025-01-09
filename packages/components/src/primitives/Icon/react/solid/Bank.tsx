import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBank = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 7.764a2.236 2.236 0 0 1-2 2.224v6.381c.648.355 1.16.947 1.404 1.682l.106.317A2 2 0 0 1 19.613 21H4.387a2 2 0 0 1-1.897-2.632l.105-.317A2.998 2.998 0 0 1 4 16.37V9.988a2.236 2.236 0 0 1-.764-4.224l7.422-3.711a3 3 0 0 1 2.684 0l7.422 3.711a2.236 2.236 0 0 1 1.236 2ZM16 10h2v6h-2v-6Zm-8 6H6v-6h2v6Zm2 0v-6h4v6h-4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBank;
