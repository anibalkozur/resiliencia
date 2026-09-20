// Polyfill mínimo de WebCrypto para Hermes (React Native).
// El runtime no expone crypto.subtle: supabase-js detecta su ausencia y degrada
// a PKCE 'plain' con un console.warn. Para evitar el warning y usar SHA-256 de
// verdad, presentamos un `subtle.digest` soportado por digestStringAsync de
// expo-crypto, además de getRandomValues y (si faltan) btoa/atob/TextEncoder.
import { CryptoDigestAlgorithm, digestStringAsync, getRandomValues } from 'expo-crypto';

function define(name: string, value: unknown): void {
  (globalThis as Record<string, unknown>)[name] = value;
}

// TextEncoder (necesario para hashear el verifier). Hermes ya suele traerlo.
if (typeof globalThis.TextEncoder === 'undefined') {
  define(
    'TextEncoder',
    class TextEncoderPolyfill {
      encode(input = ''): Uint8Array {
        const bytes: number[] = [];
        for (const ch of input) {
          const code = ch.codePointAt(0) ?? 0;
          if (code < 0x80) {
            bytes.push(code);
          } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
          } else if (code < 0x10000) {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
          } else {
            bytes.push(
              0xf0 | (code >> 18),
              0x80 | ((code >> 12) & 63),
              0x80 | ((code >> 6) & 63),
              0x80 | (code & 63),
            );
          }
        }
        return Uint8Array.from(bytes);
      }
    },
  );
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

if (typeof globalThis.btoa === 'undefined') {
  define('btoa', (input: string) => {
    let out = '';
    for (let i = 0; i < input.length; i += 3) {
      const b1 = input.charCodeAt(i);
      const b2 = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
      const b3 = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;
      out += B64[b1 >> 2];
      out += B64[((b1 & 3) << 4) | (Number.isNaN(b2) ? 0 : b2 >> 4)];
      out += Number.isNaN(b2) ? '=' : B64[((b2 & 15) << 2) | (Number.isNaN(b3) ? 0 : b3 >> 6)];
      out += Number.isNaN(b3) ? '=' : B64[b3 & 63];
    }
    return out;
  });
}

if (typeof globalThis.atob === 'undefined') {
  define('atob', (input: string) => {
    const clean = input.replace(/=+$/, '');
    let out = '';
    for (let i = 0; i < clean.length; i += 4) {
      const n0 = i < clean.length ? B64.indexOf(clean[i]) : 0;
      const n1 = i + 1 < clean.length ? B64.indexOf(clean[i + 1]) : 0;
      const n2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0;
      const n3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0;
      out += String.fromCharCode((n0 << 2) | (n1 >> 4));
      if (i + 2 < clean.length) {
        out += String.fromCharCode(((n1 & 15) << 4) | (n2 >> 2));
      }
      if (i + 3 < clean.length) {
        out += String.fromCharCode(((n2 & 3) << 6) | n3);
      }
    }
    return out;
  });
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

const subtle = {
  digest: async (_algorithm: string | Algorithm, data: BufferSource): Promise<ArrayBuffer> => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
    const text = new TextDecoder().decode(bytes);
    const hex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
    return hexToArrayBuffer(hex);
  },
} as unknown as SubtleCrypto;

const existing = (globalThis as { crypto?: Crypto }).crypto;
if (existing) {
  if (typeof existing.getRandomValues !== 'function') {
    define('crypto', {
      getRandomValues: (array: Uint8Array) => getRandomValues(array),
      subtle,
    });
  } else if (!(existing as Crypto & { subtle?: SubtleCrypto }).subtle) {
    try {
      Object.defineProperty(existing, 'subtle', { configurable: true, value: subtle });
    } catch {
      console.warn('[webcrypto] no se pudo instalar crypto.subtle; PKCE usará plain');
    }
  }
} else {
  define('crypto', {
    getRandomValues: (array: Uint8Array) => getRandomValues(array),
    subtle,
  });
}
