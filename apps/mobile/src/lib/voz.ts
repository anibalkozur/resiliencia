/**
 * TTS compartido entre el chat y el entrenador de voz.
 *
 * El TTS vive acá en React Native y no en el WebView por dos motivos:
 * `speechSynthesis` no está garantizado en el WebView de Android (puede no
 * existir y no hay forma de enterarse desde la página), y en una dev build es
 * el mismo motor nativo el que puede interrumpir a la pose de MediaPipe con el
 * mismo criterio que usa el chat.
 *
 * Se carga por import dinámico para que `expo-speech` no se eje si nadie habla.
 */
type Voz = {
  hablar: (t: string) => void;
  disponible: boolean;
};

let voz: Voz | null = null;
let cargando = false;

async function crear(): Promise<Voz> {
  try {
    const mod = await import('expo-speech');
    if (mod && typeof mod.speak === 'function') {
      return {
        disponible: true,
        hablar: (t: string) => {
          if (!t) return;
          // Cancelar antes de hablar es lo que hace que una frase nueva corte a
          // la anterior: si no, se acumulan y la locución se arrastra.
          mod.stop();
          mod.speak(t, { language: 'es-ES', rate: 1.05 });
        },
      };
    }
  } catch {
    // expo-speech no está en este runtime (Expo Go viejos): sigue solo el texto.
  }
  return { disponible: false, hablar: () => {} };
}

/** Habla una frase. Silencioso si el TTS no está disponible. */
export function hablarVoz(texto: string): void {
  if (!texto) return;
  if (voz) {
    voz.hablar(texto);
    return;
  }
  if (cargando) return;
  cargando = true;
  void crear().then((v) => {
    cargando = false;
    voz = v;
    v.hablar(texto);
  });
}

/** Si el TTS quedó cargado y funcionando. Para diagnóstico. */
export function ttsDisponible(): boolean {
  return voz?.disponible ?? false;
}