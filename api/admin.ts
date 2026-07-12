import { requireAdminAuth } from "../lib/auth.js";
import { ensureResponseHelpers, type VercelRequest, type VercelResponse } from "../lib/vercel.js";

const page = String.raw`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>管理者設定 | やさしい習慣リマインダー</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7fffc;
        --panel: #ffffff;
        --mint: #c7f0ea;
        --mint-deep: #6cc8bb;
        --cream: #fff8ea;
        --ink: #53666b;
        --muted: #8a9b9f;
        --line: #d8f4ef;
        --shadow: 0 18px 42px rgba(108, 200, 187, 0.18);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 18% 12%, #effffc 0 18%, transparent 36%),
          radial-gradient(circle at 84% 82%, #fff5ec 0 16%, transparent 34%),
          var(--bg);
      }

      main {
        width: min(820px, calc(100vw - 28px));
        margin: 28px auto;
      }

      a {
        color: var(--mint-deep);
        font-weight: 800;
        text-decoration: none;
      }

      .panel {
        margin-top: 18px;
        padding: 22px;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
      }

      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }

      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .status-grid {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }

      .status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 13px 14px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 16px;
      }

      .badge {
        flex: 0 0 auto;
        border-radius: 999px;
        padding: 5px 10px;
        background: #fff2d3;
        color: #9a7a27;
        font-size: 12px;
        font-weight: 900;
      }

      .badge.ok {
        background: #dff8f0;
        color: #438c7b;
      }

      code {
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--cream);
      }

      form {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }

      label {
        font-size: 13px;
        font-weight: 900;
      }

      input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 13px 14px;
        color: var(--ink);
        font: inherit;
      }

      button {
        width: fit-content;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--mint-deep);
        color: #fff;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }

      .result {
        min-height: 24px;
        color: var(--muted);
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main>
      <a href="/">← アプリ画面へ戻る</a>
      <section class="panel">
        <h1>管理者設定</h1>
        <p>Supabase、LINE、Cronの接続状態だけを確認します。秘密情報の中身は表示しません。</p>
        <div class="status-grid" id="setup-status"></div>
      </section>
      <section class="panel">
        <h1>次に必要な設定</h1>
        <p><code>SUPABASE_URL</code> と <code>SUPABASE_SERVICE_ROLE_KEY</code> を入れると、保存確認へ進めます。</p>
      </section>
      <section class="panel">
        <h1>LINEテスト送信</h1>
        <p>友だち追加時に届く「テスト用ID」を貼ると、佑哉さんのLINEへテスト通知を送れます。</p>
        <form id="line-test-form">
          <label for="lineUserId">LINE userId</label>
          <input id="lineUserId" name="lineUserId" placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required />
          <button type="submit">テスト通知を送る</button>
          <div class="result" id="line-test-result"></div>
        </form>
      </section>
    </main>
    <script>
      const setupStatus = document.getElementById("setup-status");
      const lineTestForm = document.getElementById("line-test-form");
      const lineTestResult = document.getElementById("line-test-result");

      function statusBadge(ok) {
        return ok ? "<span class=\"badge ok\">OK</span>" : "<span class=\"badge\">未設定</span>";
      }

      function connectionBadge(status) {
        if (status === "ready") return "<span class=\"badge ok\">接続OK</span>";
        if (status === "error") return "<span class=\"badge\">要確認</span>";
        return "<span class=\"badge\">未設定</span>";
      }

      async function loadSetupStatus() {
        try {
          const response = await fetch("/api/setup-status");
          if (!response.ok) throw new Error("failed");
          const data = await response.json();
          const rows = [
            ["管理ログイン", data.env.adminUsername && data.env.adminPassword],
            ["Supabase URL", data.env.supabaseUrl],
            ["Supabase Key", data.env.supabaseServiceRoleKey],
            ["Supabase 接続", data.supabaseConnection],
            ["LINE Token", data.env.lineChannelAccessToken],
            ["LINE Secret", data.env.lineChannelSecret],
            ["Cron Secret", data.env.cronSecret]
          ];

          setupStatus.innerHTML = rows.map(([label, value]) => {
            const badge = label === "Supabase 接続" ? connectionBadge(value) : statusBadge(Boolean(value));
            return "<div class=\"status-row\"><span>" + label + "</span>" + badge + "</div>";
          }).join("");
        } catch (_error) {
          setupStatus.innerHTML = "<div class=\"status-row\"><span>設定状態</span><span class=\"badge\">確認不可</span></div>";
        }
      }

      loadSetupStatus();

      lineTestForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        lineTestResult.textContent = "送信中...";
        const formData = new FormData(lineTestForm);

        try {
          const response = await fetch("/api/test-line-push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lineUserId: formData.get("lineUserId") })
          });

          if (!response.ok) {
            throw new Error("failed");
          }

          lineTestResult.textContent = "送信しました。LINEを確認してください。";
        } catch (_error) {
          lineTestResult.textContent = "送信できませんでした。LINE設定を確認してください。";
        }
      });
    </script>
  </body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = ensureResponseHelpers(res);
  const origin = req.headers.host ? `http://${req.headers.host}` : "http://localhost";
  const request = new Request(`${origin}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as HeadersInit
  });
  const authError = requireAdminAuth(request);
  if (authError) {
    response.status(authError.status);
    for (const [key, value] of authError.headers.entries()) {
      response.setHeader(key, value);
    }
    response.send(await authError.text());
    return;
  }

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.status(200).send(page);
}
