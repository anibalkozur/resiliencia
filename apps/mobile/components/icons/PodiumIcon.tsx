import Svg, { Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type IconProps = {
  color: ColorValue;
  size: number;
};

export default function PodiumIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={4} width={6} height={17} rx={1} fill={color} />
      <Rect x={3} y={9} width={5} height={12} rx={1} fill={color} />
      <Rect x={16} y={12} width={5} height={9} rx={1} fill={color} />
    </Svg>
  );
}
