
// =====================================================================
// Keep-alive do Supabase (chamado pelo cron da Vercel 1x por dia)
// ---------------------------------------------------------------------
// - Só aceita chamada com o header "Authorization: Bearer <CRON_SECRET>"
//   (a Vercel manda isso sozinha quando a variável CRON_SECRET existe).
// - Chama a função public.keep_alive() no Supabase, que só devolve 1
//   e não toca em nenhum dado. Isso conta como atividade e o projeto
//   gratuito não pausa.
// - Erros aparecem nos logs da Vercel (Deployments > Functions / Logs).
// =====================================================================

// URL e key pública são as mesmas do index.html (já são públicas).
// Dá pra sobrescrever criando SUPABASE_URL / SUPABASE_KEY na Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rgdpudnuwvdtdznpzqzk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_lEIYdfrQu5YUGPl3pKWD6w_O1yNjsBa';

module.exports = async (req, res) => {
  // ---------- 1. Segurança: sem CRON_SECRET configurado, não roda
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[keep-alive] CRON_SECRET não configurado na Vercel');
    return res.status(500).json({ ok: false, erro: 'CRON_SECRET não configurado' });
  }

  // ---------- 2. Só a Vercel (ou quem tem o segredo) pode chamar
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, erro: 'não autorizado' });
  }

  // ---------- 3. Ping no Supabase (timeout de 8s, o limite do plano é 10s)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keep_alive`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });

    const texto = await r.text();

    if (!r.ok) {
      console.error(`[keep-alive] Supabase respondeu ${r.status}: ${texto}`);
      return res.status(502).json({ ok: false, status: r.status, resposta: texto });
    }

    console.log(`[keep-alive] ok, Supabase respondeu: ${texto}`);
    return res.status(200).json({ ok: true, resposta: texto, em: new Date().toISOString() });
  } catch (e) {
    const motivo = e.name === 'AbortError' ? 'timeout (8s)' : e.message;
    console.error(`[keep-alive] falhou: ${motivo}`);
    return res.status(504).json({ ok: false, erro: motivo });
  } finally {
    clearTimeout(timer);
  }
};
