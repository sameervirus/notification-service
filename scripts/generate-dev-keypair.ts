import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const dir = ".dev-keys";
mkdirSync(dir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync(`${dir}/private.pem`, privateKey);
writeFileSync(`${dir}/public.pem`, publicKey);

console.log(`Dev RSA keypair written to ${dir}/private.pem and ${dir}/public.pem`);
console.log("Copy public.pem into JWT_PUBLIC_KEY in your .env (this is not for production use).");
