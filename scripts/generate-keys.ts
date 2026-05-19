import * as ed from "@noble/ed25519";

const priv = crypto.getRandomValues(new Uint8Array(32));
const pub = await ed.getPublicKeyAsync(priv);

console.log("Salin ke .env:\n");
console.log(`ACTIVATION_PRIVATE_KEY=${Buffer.from(priv).toString("base64")}`);
console.log(`ACTIVATION_PUBLIC_KEY=${Buffer.from(pub).toString("base64")}`);
console.log(
  "\nPublic key juga perlu disematkan di EasyBook (src-tauri) untuk verifikasi offline.",
);
