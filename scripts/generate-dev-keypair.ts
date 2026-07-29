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

const publicKeyBase64 = Buffer.from(publicKey, "utf8").toString("base64");
writeFileSync(`${dir}/public.pem.base64`, publicKeyBase64);

console.log(`Dev RSA keypair written to ${dir}/private.pem and ${dir}/public.pem`);
console.log("(this is not for production use)");
console.log();
console.log("For JWT_PUBLIC_KEY, use the base64 form — paste it as-is, no quotes needed:");
console.log(publicKeyBase64);
