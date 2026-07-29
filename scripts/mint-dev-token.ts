import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";

const sub = process.argv[2] ?? "dev-backend";
const privateKey = readFileSync(".dev-keys/private.pem", "utf8");

const token = jwt.sign({}, privateKey, {
  algorithm: "RS256",
  subject: sub,
  issuer: process.env.JWT_ISSUER ?? "notification-service-clients",
  audience: process.env.JWT_AUDIENCE ?? "notification-service",
  expiresIn: "1h",
});

console.log(token);
