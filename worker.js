// Cloudflare Worker: (1) sends each order + payment screenshot to your EMAIL (Resend) and/or your Telegram, (2) stores the prices you set in the hidden admin page.
// EMAIL: create a free account at resend.com, make an API key, then set RESEND_API_KEY = that key and OWNER_EMAIL = the SAME email you signed up to Resend with.
//   (Until you verify your own domain at Resend, it only delivers to your own account email. That is exactly what you want here.)
// TELEGRAM (optional): create a bot with @BotFather, message your bot once, then set these as Worker secrets/variables:
//   BOT_TOKEN = your bot token   CHAT_ID = your Telegram user/chat id   ORIGIN = your site address(es), comma separated, e.g. https://you.github.io,https://gow.vercel.app,https://yourdomain.com
//   ADMIN_PASSWORD = a long password only you know (opens the admin page: your site address + #admin)
//   And bind a KV namespace named PRICES (Workers > KV) so prices are saved.
// Put this Worker's URL in CONFIG.endpoint in the website file. The token stays on the server, never in the page.
async function sendTelegram(env, text, photo) {
  const base = `https://api.telegram.org/bot${env.BOT_TOKEN}/`;
  let r;
  if (photo) {
    const out = new FormData();
    out.append('chat_id', env.CHAT_ID); out.append('caption', text); out.append('photo', photo, 'payment.jpg');
    r = await fetch(base + 'sendPhoto', { method: 'POST', body: out });
  } else {
    r = await fetch(base + 'sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.CHAT_ID, text }) });
  }
  return r.ok;
}

// Email through Resend: the order text in the body, the payment screenshot as an attachment.
async function sendEmail(env, text, photo) {
  const attachments = [];
  if (photo) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    attachments.push({ filename: 'payment-screenshot.jpg', content: btoa(bin) });
  }
  const id = (text.match(/(?:ORDER|QUOTE REQUEST) (\S+)/) || [])[1] || '';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'GOW Store <onboarding@resend.dev>', to: [env.OWNER_EMAIL], subject: `New order ${id}`.trim(), text, attachments })
  });
  return r.ok;
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { return new Response('error', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }); }
  }
};

async function handle(req, env) {
    const origins = String(env.ORIGIN || '').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
    const reqOrigin = req.headers.get('Origin') || '';
    const allow = origins.length ? (origins.includes(reqOrigin) ? reqOrigin : origins[0]) : '*';
    const cors = { 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname;
    const admin = () => (req.headers.get('X-Admin') || '') === env.ADMIN_PASSWORD && !!env.ADMIN_PASSWORD;
    if (path === '/prices' && req.method === 'GET') return new Response((env.PRICES ? await env.PRICES.get('cfg') : null) || 'null', { headers: { ...cors, 'Content-Type': 'application/json' } });
    if (path === '/auth' && req.method === 'POST') { if (!admin()) { await new Promise(r => setTimeout(r, 800)); return new Response('no', { status: 401, headers: cors }); } return new Response('ok', { headers: cors }); }
    if (path === '/prices' && req.method === 'POST') {
      if (!admin()) return new Response('no', { status: 401, headers: cors });
      if (!env.PRICES) return new Response('Storage not connected: bind a KV namespace named PRICES', { status: 501, headers: cors });
      const body = await req.text(); if (body.length > 20000) return new Response('too big', { status: 413, headers: cors });
      JSON.parse(body); await env.PRICES.put('cfg', body); return new Response('ok', { headers: cors });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    try {
      const f = await req.formData();
      const text = String(f.get('text') || '').slice(0, 900);
      const photo = f.get('photo');
      const hasPhoto = photo && typeof photo !== 'string';
      if (hasPhoto && (photo.size > 8 * 1024 * 1024 || !String(photo.type).startsWith('image/'))) return new Response('Bad image', { status: 400, headers: cors });
      const jobs = [];
      if (env.BOT_TOKEN && env.CHAT_ID) jobs.push(sendTelegram(env, text, hasPhoto ? photo : null));
      if (env.RESEND_API_KEY && env.OWNER_EMAIL) jobs.push(sendEmail(env, text, hasPhoto ? photo : null));
      if (!jobs.length) return new Response('Not configured', { status: 500, headers: cors });
      const results = await Promise.all(jobs.map(j => j.catch(() => false)));
      const ok = results.some(Boolean);
      return new Response(ok ? 'ok' : 'send failed', { status: ok ? 200 : 502, headers: cors });
    } catch (e) { return new Response('error', { status: 500, headers: cors }); }
}
