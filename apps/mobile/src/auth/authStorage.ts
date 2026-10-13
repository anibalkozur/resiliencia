import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getRepo } from '../repo';

// El token de sesión (bearer) es una credencial sensible: en móvil se guarda
// cifrado con la llave del sistema operativo (Keychain/Keystore) vía
// expo-secure-store, nunca en texto plano en SQLite. En web no existe
// SecureStore, así que cae al almacenamiento del repo.
//
// SecureStore limita cada valor a ~2048 bytes y la sesión de Supabase (JWT +
// refresh token + usuario) puede superarlo, así que se parte en trozos: cada
// trozo se guarda con clave `<key>.<i>` y la cantidad en `<key>.count`.

const CHUNK_SIZE = 1800;
const COUNT_SUFFIX = '.count';

const secureAvailable = Platform.OS !== 'web';

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

function countKey(key: string): string {
  return `${key}${COUNT_SUFFIX}`;
}

function parseCount(raw: string | null): number {
  if (raw === null) return 0;
  const count = Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function secureGet(key: string): Promise<string | null> {
  const count = parseCount(await SecureStore.getItemAsync(countKey(key)));
  if (count === 0) return null;
  let value = '';
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part === null) return null;
    value += part;
  }
  return value;
}

async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);
  const total = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < total; i += 1) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.setItemAsync(countKey(key), String(total));
}

async function secureRemove(key: string): Promise<void> {
  const count = parseCount(await SecureStore.getItemAsync(countKey(key)));
  await SecureStore.deleteItemAsync(countKey(key));
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (secureAvailable) {
      try {
        const value = await secureGet(key);
        if (value !== null) return value;
        // Migración: si quedó una sesión previa en texto plano (SQLite), la
        // movemos a SecureStore y borramos el original.
        const legacy = await getRepo().getSetting(key);
        if (legacy !== null) {
          await secureSet(key, legacy);
          await getRepo().removeSetting(key);
          return legacy;
        }
        return null;
      } catch {
        return getRepo().getSetting(key);
      }
    }
    return getRepo().getSetting(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (secureAvailable) {
      try {
        await secureSet(key, value);
        await getRepo().removeSetting(key);
        return;
      } catch {
        // Si SecureStore no está disponible, no perdemos la sesión.
      }
    }
    await getRepo().setSetting(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (secureAvailable) {
      try {
        await secureRemove(key);
      } catch {
        // best-effort
      }
    }
    await getRepo().removeSetting(key);
  },
};
