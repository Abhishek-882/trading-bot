import bs58Module from 'bs58';

const bs58 = bs58Module.default || bs58Module;

export function getBase58Decoder() {
  return {
    decode: (bytes) => bs58.encode(bytes),
  };
}

export function getBase58Encoder() {
  return {
    encode: (str) => bs58.decode(str),
  };
}

export function getBase64Decoder() {
  return {
    decode: (bytes) => {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    },
  };
}

export function getBase64Encoder() {
  return {
    encode: (str) => {
      const binary = atob(str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },
  };
}

export function getUtf8Decoder() {
  return new TextDecoder();
}

export function getUtf8Encoder() {
  return new TextEncoder();
}
