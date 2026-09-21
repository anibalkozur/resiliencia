import Svg, { Polyline } from 'react-native-svg';
import type { IconProps } from './HouseIcon';

export default function BoltIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
