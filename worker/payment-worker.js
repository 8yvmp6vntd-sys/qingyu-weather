// Cloudflare Worker - 支付验证码后端
// 用户扫码支付后，输入交易号后6位作为验证码
// Worker 记录验证码，前端轮询确认

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin") || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    try {
      // POST /claim - 用户提交验证码认领主题
      if (path === "/claim" && request.method === "POST") {
        const body = await request.json();
        const { code, theme } = body;

        if (!code || !theme) {
          return new Response(JSON.stringify({ errcode: 400, errmsg: "缺少参数" }), {
            status: 400, headers: corsHeaders,
          });
        }

        // 验证码格式：6位数字
        if (!/^\d{6}$/.test(code)) {
          return new Response(JSON.stringify({ errcode: 400, errmsg: "验证码格式错误，请输入6位数字" }), {
            status: 400, headers: corsHeaders,
          });
        }

        // 检查验证码是否已被使用
        const existing = await env.PAID_THEMES.get(`code_${code}`);
        if (existing) {
          const data = JSON.parse(existing);
          return new Response(JSON.stringify({
            errcode: 0,
            claimed: true,
            theme: data.theme,
            already_used_by_theme: data.theme,
          }), { headers: corsHeaders });
        }

        // 记录验证码 -> 主题映射
        await env.PAID_THEMES.put(`code_${code}`, JSON.stringify({
          theme,
          time: Date.now(),
        }), { expirationTtl: 86400 * 30 }); // 30天有效

        return new Response(JSON.stringify({
          errcode: 0,
          claimed: true,
          theme,
        }), { headers: corsHeaders });
      }

      // GET /check?code=xxx - 前端检查验证码是否已提交
      if (path === "/check" && request.method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response(JSON.stringify({ errcode: 400, errmsg: "缺少 code" }), {
            status: 400, headers: corsHeaders,
          });
        }

        const existing = await env.PAID_THEMES.get(`code_${code}`);
        if (existing) {
          const data = JSON.parse(existing);
          return new Response(JSON.stringify({
            errcode: 0,
            verified: true,
            theme: data.theme,
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({
          errcode: 0,
          verified: false,
        }), { headers: corsHeaders });
      }

      // GET /verify-code?code=xxx&theme=xxx - 检查特定验证码是否解锁了特定主题
      if (path === "/verify-code" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const theme = url.searchParams.get("theme");

        const existing = await env.PAID_THEMES.get(`code_${code}`);
        if (existing) {
          const data = JSON.parse(existing);
          if (data.theme === theme) {
            return new Response(JSON.stringify({
              errcode: 0,
              valid: true,
            }), { headers: corsHeaders });
          }
        }

        return new Response(JSON.stringify({
          errcode: 0,
          valid: false,
        }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ errcode: 404, errmsg: "not found" }), {
        status: 404, headers: corsHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ errcode: 500, errmsg: e.message }), {
        status: 500, headers: corsHeaders,
      });
    }
  },
};
