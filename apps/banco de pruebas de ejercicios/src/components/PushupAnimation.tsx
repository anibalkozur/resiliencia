import { VideoView, useVideoPlayer } from 'expo-video';
import { Image, StyleSheet, View } from 'react-native';

type Props = {
  size?: 'small' | 'large';
};

const PREVIEW_VIDEO = require('../../assets/ejercicios/abdominales/frames/flexiones mujer/flexiones_mujer_480x320.mp4');
const CARD_POSE = require('../../assets/ejercicios/abdominales/frames/flexiones mujer/03-up-flexiones-mujer-transparente.png');

function PushupVideoPreview() {
  const player = useVideoPlayer(PREVIEW_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <VideoView
      accessibilityLabel="Animación de flexiones"
      contentFit="contain"
      nativeControls={false}
      player={player}
      style={styles.figure}
    />
  );
}

/** Tarjeta estática y video de técnica para flexiones en el banco de pruebas. */
export function PushupAnimation({ size = 'small' }: Props) {
  const compact = size === 'small';

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.scene, compact ? styles.sceneSmall : styles.sceneLarge]}
    >
      {!compact ? <View style={styles.glow} /> : null}
      {!compact ? <View style={styles.floor} /> : null}
      {compact ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Ejemplo de flexiones"
          resizeMode="contain"
          source={CARD_POSE}
          style={styles.figure}
        />
      ) : (
        <PushupVideoPreview />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: '#081018',
    borderColor: '#1E2630',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  sceneSmall: { backgroundColor: '#000000', height: 86, marginTop: 10, width: '100%' },
  sceneLarge: { height: 210, marginBottom: 14, width: '100%' },
  glow: {
    backgroundColor: '#173F31',
    borderRadius: 999,
    height: 150,
    opacity: 0.36,
    position: 'absolute',
    right: '9%',
    top: -76,
    width: 150,
  },
  floor: {
    backgroundColor: '#39D98A',
    borderRadius: 99,
    bottom: 13,
    height: 2,
    left: '14%',
    opacity: 0.5,
    position: 'absolute',
    right: '14%',
  },
  figure: { height: '100%', position: 'absolute', width: '100%' },
});
