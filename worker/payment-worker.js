// Cloudflare Worker - 虎皮椒支付代理
// 部署后需要设置环境变量:
//   XUNHU_APPID    - 虎皮椒 APPID
//   XUNHU_SECRET   - 虎皮椒 APPSECRET
//   XUNHU_GATEWAY  - 支付网关 (默认 https://api.xunhupay.com)
//   ALLOWED_ORIGIN - 允许的前端域名 (默认 *)

const PAY_PATH = "/payment/do.html";
const QUERY_PATH = "/payment/query.html";

function generateHash(params, secret) {
  const keys = Object.keys(params).filter(
    (k) => k !== "hash" && params[k] !== null && params[k] !== undefined && params[k] !== ""
  );
  keys.sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join("&");
  return md5(str + secret);
}

// Simple MD5 implementation for Cloudflare Worker
function md5(string) {
  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md51(s) {
    var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for (i = 0; i < s.length; i++)
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function md5blk(s) {
    var md5blks = [], i;
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  var hex_chr = "0123456789abcdef".split("");
  function rhex(n) {
    var s = "", j = 0;
    for (; j < 4; j++)
      s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
    return s;
  }
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function hex(x) {
    for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
    return x.join("");
  }
  return hex(md51(string));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleCreateOrder(request, env) {
  const { appid, secret, gateway } = getCredentials(env);

  const body = await request.json();
  const { theme, total_fee = "1.00" } = body;

  if (!theme) {
    return jsonResponse({ errcode: 400, errmsg: "缺少 theme 参数" });
  }

  const tradeOrderId = `theme_${theme}_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = Math.random().toString(36).substring(2, 15);

  const siteUrl = env.SITE_URL || "https://8yvmp6vntd-sys.github.io/qingyu-weather/";
  const workerUrl = env.WORKER_URL || new URL(request.url).origin;

  const params = {
    version: "1.1",
    appid,
    trade_order_id: tradeOrderId,
    total_fee,
    title: `更换背景主题-${theme}`,
    time: timestamp,
    notify_url: `${workerUrl}/notify`,
    return_url: `${siteUrl}?theme=${theme}&paid=1`,
    nonce_str: nonceStr,
  };

  params.hash = generateHash(params, secret);

  try {
    const resp = await fetch(`${gateway}${PAY_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await resp.json();

    if (data.errcode !== 0) {
      return jsonResponse({ errcode: data.errcode, errmsg: data.errmsg });
    }

    return jsonResponse({
      errcode: 0,
      url_qrcode: data.url_qrcode,
      url: data.url,
      trade_order_id: tradeOrderId,
      hash: data.hash,
    });
  } catch (e) {
    return jsonResponse({ errcode: 500, errmsg: "支付网关请求失败: " + e.message });
  }
}

async function handleNotify(request, env) {
  const { secret } = getCredentials(env);
  const formData = await request.formData();
  const params = {};

  for (const [key, value] of formData.entries()) {
    params[key] = value;
  }

  // Verify signature
  const receivedHash = params.hash;
  const expectedHash = generateHash(params, secret);

  if (receivedHash !== expectedHash) {
    return new Response("invalid signature", { status: 400 });
  }

  const status = params.status;
  const tradeOrderId = params.trade_order_id;
  const totalFee = params.total_fee;

  if (status === "OD") {
    // Payment successful - extract theme from order id
    // trade_order_id format: theme_{themeName}_{timestamp}
    const parts = tradeOrderId.split("_");
    const themeName = parts[1];

    // Store in KV that this theme is unlocked for this order
    // We use the order id as the key to prevent replay
    const kvKey = `paid_${tradeOrderId}`;
    await env.PAID_THEMES.put(kvKey, JSON.stringify({
      theme: themeName,
      total_fee: totalFee,
      time: Math.floor(Date.now() / 1000),
    }), { expirationTtl: 86400 * 365 }); // 1 year

    return new Response("success");
  }

  return new Response("success");
}

async function handleQuery(request, env) {
  const { appid, secret, gateway } = getCredentials(env);

  const { searchParams } = new URL(request.url);
  const tradeOrderId = searchParams.get("trade_order_id");

  if (!tradeOrderId) {
    return jsonResponse({ errcode: 400, errmsg: "缺少 trade_order_id" });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = Math.random().toString(36).substring(2, 15);

  const params = {
    appid,
    out_trade_order: tradeOrderId,
    time: timestamp,
    nonce_str: nonceStr,
  };

  params.hash = generateHash(params, secret);

  try {
    const resp = await fetch(`${gateway}${QUERY_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await resp.json();
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ errcode: 500, errmsg: "查询失败: " + e.message });
  }
}

async function handleVerify(request, env) {
  const { searchParams } = new URL(request.url);
  const tradeOrderId = searchParams.get("trade_order_id");

  if (!tradeOrderId) {
    return jsonResponse({ errcode: 400, errmsg: "缺少 trade_order_id" });
  }

  // Check KV for payment record
  const kvKey = `paid_${tradeOrderId}`;
  const record = await env.PAID_THEMES.get(kvKey);

  if (record) {
    const data = JSON.parse(record);
    return jsonResponse({ errcode: 0, paid: true, theme: data.theme });
  }

  return jsonResponse({ errcode: 0, paid: false });
}

function getCredentials(env) {
  return {
    appid: env.XUNHU_APPID || "",
    secret: env.XUNHU_SECRET || "",
    gateway: env.XUNHU_GATEWAY || "https://api.xunhupay.com",
  };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin") || "*";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      if (path === "/create" && request.method === "POST") {
        const resp = await handleCreateOrder(request, env);
        const newHeaders = { ...corsHeaders(origin), "Content-Type": "application/json" };
        return new Response(resp.body, { status: resp.status, headers: newHeaders });
      }

      if (path === "/notify" && request.method === "POST") {
        return handleNotify(request, env);
      }

      if (path === "/query" && request.method === "GET") {
        const resp = await handleQuery(request, env);
        const newHeaders = { ...corsHeaders(origin), "Content-Type": "application/json" };
        return new Response(resp.body, { status: resp.status, headers: newHeaders });
      }

      if (path === "/verify" && request.method === "GET") {
        const resp = await handleVerify(request, env);
        const newHeaders = { ...corsHeaders(origin), "Content-Type": "application/json" };
        return new Response(resp.body, { status: resp.status, headers: newHeaders });
      }

      return jsonResponse({ errcode: 404, errmsg: "not found" }, 404);
    } catch (e) {
      return jsonResponse({ errcode: 500, errmsg: e.message }, 500);
    }
  },
};
