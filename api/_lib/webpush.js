// Minimal Web Push sender (RFC 8291 aes128gcm + RFC 8292 VAPID). No outside packages.
const crypto = require("crypto");
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

function vapidKeys() {
  const pub = unb64u(process.env.VAPID_PUBLIC_KEY || ""), d = process.env.VAPID_PRIVATE_KEY || "";
  if (pub.length !== 65 || !d) return null;
  const key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: "jwk" });
  return { pub, key };
}
function vapidAuth(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key: keys.key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${b64u(keys.pub)}`;
}
function encrypt(payload, sub) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const as = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  const prkKey = hmac(auth, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), ua, as, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([as.length]), as, ct]);
}
async function send(sub, payload, opts = {}) {
  const keys = vapidKeys(); if (!keys) throw new Error("VAPID keys missing");
  const r = await fetch(sub.endpoint, { method: "POST", headers: {
    "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(opts.ttl || 6 * 3600), Urgency: opts.urgency || "high",
    ...(opts.topic ? { Topic: opts.topic } : {}), Authorization: vapidAuth(sub.endpoint, keys, opts.subject || "https://prolight-boardv1.vercel.app") },
    body: encrypt(typeof payload === "string" ? payload : JSON.stringify(payload), sub) });
  return r.status;
}
module.exports = { send, encrypt, vapidAuth, b64u, unb64u };
