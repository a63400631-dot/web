import client from "../dist/assets/client.txt";
import css from "../src/globals.css";
import icon from "../src/icon.svg";
import { change } from "../lib/model";

const cookieName = "__Host-family-weight";
const lifetime = 30 * 24 * 60 * 60;
const utf8 = new TextEncoder();
const asHex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
const hash = async text => asHex(await crypto.subtle.digest("SHA-256", utf8.encode(text)));

async function signature(secret, payload) {
  const key = await crypto.subtle.importKey("raw", utf8.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return asHex(await crypto.subtle.sign("HMAC", key, utf8.encode(payload)));
}

function matches(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function time() { return Math.floor(Date.now() / 1000); }

async function signedIn(request, env) {
  if (!env.FAMILY_PASSWORD || !env.SESSION_SECRET) return false;
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-family-weight=(\d{10}\.[0-9a-f-]{36})\.([0-9a-f]{64})(?:;|$)/);
  return !!raw && Number(raw[1].slice(0, 10)) > time() &&
    matches(raw[2], await signature(env.SESSION_SECRET, raw[1] + ":" + env.FAMILY_PASSWORD));
}

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const json = (data, status = 200, options = {}) => Response.json(data, { status, headers: { ...headers, ...options } });
const sessionCookie = (value, age) => cookieName + "=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" + age;

async function sessions(request, env) {
  if (request.method === "DELETE") return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  if (!env.FAMILY_PASSWORD || !env.SESSION_SECRET) return json({ error: "家庭访问尚未配置。" }, 503);
  const { password } = await request.json().catch(() => ({})) ?? {};
  if (typeof password !== "string" || !password || password.length > 256) return json({ error: "请输入家庭密码。" }, 400);
  const bucket = await signature(env.SESSION_SECRET, request.headers.get("CF-Connecting-IP") ?? "default");
  const now = time();
  const row = await env.DB.prepare(`
    INSERT INTO login_limits VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET
    attempts = CASE WHEN started <= ? THEN 1 ELSE min(attempts + 1, 11) END,
    started = CASE WHEN started <= ? THEN excluded.started ELSE started END
    RETURNING attempts
  `).bind(bucket, now, now - 900, now - 900).first();
  if (row.attempts > 10) return json({ error: "尝试次数过多，请 15 分钟后再试。" }, 429);
  if (!matches(await hash(password), await hash(env.FAMILY_PASSWORD))) return json({ error: "家庭密码不正确。" }, 401);
  const token = (now + lifetime) + "." + crypto.randomUUID();
  const proof = await signature(env.SESSION_SECRET, token + ":" + env.FAMILY_PASSWORD);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token + "." + proof, lifetime) });
}

async function write(db, input) {
  switch (input.action) {
    case "add": return db.prepare("INSERT INTO members (id, name) VALUES (?, ?)").bind(crypto.randomUUID(), input.name).run();
    case "rename": return db.prepare("UPDATE members SET name = ? WHERE id = ?").bind(input.name, input.id).run();
    case "remove": return db.prepare("DELETE FROM members WHERE id = ?").bind(input.id).run();
    case "goal": return db.prepare("UPDATE members SET initial = ?, target = ?, deadline = ? WHERE id = ?").bind(input.initial, input.target, input.deadline, input.id).run();
    case "erase": return db.prepare("DELETE FROM records WHERE member_id = ? AND day = ?").bind(input.id, input.day).run();
    case "record": {
      const columns = ["morning", "evening", "note"].filter(key => input[key] !== undefined);
      const upsert = db.prepare(`INSERT INTO records (member_id, day, ${columns.join(", ")})
        VALUES (?, ?, ${columns.map(() => "?").join(", ")})
        ON CONFLICT (member_id, day) DO UPDATE SET ${columns.map(key => key + " = excluded." + key).join(", ")}`)
        .bind(input.id, input.day, ...columns.map(key => input[key]));
      return db.batch([upsert, db.prepare("DELETE FROM records WHERE member_id = ? AND day = ? AND morning IS NULL AND evening IS NULL").bind(input.id, input.day)]);
    }
  }
}

function document(auth) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>轻秤 · 家庭体重记录</title><link rel="icon" href="/icon.svg"><link rel="stylesheet" href="/app.css"><script defer src="/app.js"></script></head><body><div id="root" data-authenticated="${auth ? "yes" : "no"}"></div></body></html>`;
}

const assets = { "/app.js": [client, "application/javascript"], "/app.css": [css, "text/css"], "/icon.svg": [icon, "image/svg+xml"] };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
      if (request.method === "GET" && asset) return new Response(asset[0], { headers: { ...headers, "Content-Type": asset[1] + "; charset=utf-8" } });
      if (request.method === "GET" && url.pathname === "/") {
        return new Response(document(await signedIn(request, env)), { headers: { ...headers, "Content-Type": "text/html;charset=utf-8" } });
      }
      if (!["/api/session", "/api/data"].includes(url.pathname)) return json({ error: "页面不存在。" }, 404);
      if (request.method !== "GET" && request.headers.get("origin") !== url.origin) return json({ error: "请求来源无效。" }, 403);
      if (url.pathname === "/api/session" && ["POST", "DELETE"].includes(request.method)) return await sessions(request, env);
      if (url.pathname !== "/api/data") return json({ error: "请求无效。" }, 405);
      if (!await signedIn(request, env)) return json({ error: "请重新输入家庭密码。" }, 401);
      if (request.method === "GET") {
        const [members, records] = await env.DB.batch([
          env.DB.prepare("SELECT id, name, initial, target, deadline FROM members ORDER BY rowid"),
          env.DB.prepare("SELECT member_id, day, morning, evening, note FROM records ORDER BY day, member_id"),
        ]);
        return json({ members: members.results, records: records.results });
      }
      if (request.method !== "POST") return json({ error: "请求无效。" }, 405);
      const input = change.safeParse(await request.json().catch(() => null));
      if (!input.success) return json({ error: "请检查日期、昵称或体重格式（1–700 kg，最多一位小数）。" }, 400);
      await write(env.DB, input.data);
      return json({ ok: true });
    } catch {
      return json({ error: "服务暂不可用，请稍后重试。" }, 503);
    }
  },
};
