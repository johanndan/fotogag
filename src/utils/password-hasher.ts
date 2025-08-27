// src/utils/password-hasher.ts

interface HashPasswordParams {
  password: string;
  providedSalt?: Uint8Array;
}

// Hilfsfunktion: erzeugt ein EXAKTES ArrayBuffer aus Uint8Array
function toExactArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

async function hashPassword({ password, providedSalt }: HashPasswordParams) {
  const encoder = new TextEncoder();

  // Entweder gegebenes Salt nutzen oder ein neues erzeugen
  const saltBytes = providedSalt ?? crypto.getRandomValues(new Uint8Array(16));

  // Passwort-Material importieren
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // PBKDF2 → AES-GCM Key ableiten
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // WICHTIG: echtes ArrayBuffer übergeben (BufferSource-Anforderung)
      salt: toExactArrayBuffer(saltBytes),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // exportierbar, damit wir den Raw-Key auslesen können
    ["encrypt", "decrypt"]
  );

  // Abgeleiteten Key als Bytes exportieren und hex-kodieren
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  const hashHex = Array.from(raw).map(b => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  return `${saltHex}:${hashHex}`;
}

interface VerifyPasswordParams {
  storedHash: string;
  passwordAttempt: string;
}

async function verifyPassword({ storedHash, passwordAttempt }: VerifyPasswordParams) {
  const [saltHex, originalHash] = storedHash.split(":");

  // Hex → Bytes
  const saltBytes = new Uint8Array((saltHex.match(/.{1,2}/g) ?? []).map(h => parseInt(h, 16)));

  // Mit gleichem Salt erneut hashen und vergleichen
  const attempt = await hashPassword({ password: passwordAttempt, providedSalt: saltBytes });
  const [, attemptHash] = attempt.split(":");

  return attemptHash === originalHash;
}

export { hashPassword, verifyPassword };
