import { requireAdminAuth } from "../lib/auth.js";
import { ensureResponseHelpers, type VercelRequest, type VercelResponse } from "../lib/vercel.js";

const page = String.raw`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>やさしい習慣リマインダー</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7fffc;
        --panel: #ffffff;
        --mint: #c7f0ea;
        --mint-soft: #e9fbf7;
        --mint-deep: #6cc8bb;
        --cream: #fff8ea;
        --cream-deep: #f5ead5;
        --coral: #f5aaa2;
        --gold: #ffd979;
        --ink: #53666b;
        --muted: #8a9b9f;
        --line: #d8f4ef;
        --shadow: 0 18px 42px rgba(108, 200, 187, 0.2);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        color: var(--ink);
        background:
          linear-gradient(90deg, rgba(199, 240, 234, 0.3) 1px, transparent 1px),
          linear-gradient(0deg, rgba(199, 240, 234, 0.26) 1px, transparent 1px),
          radial-gradient(circle at 18% 12%, #effffc 0 18%, transparent 36%),
          radial-gradient(circle at 84% 82%, #fff5ec 0 16%, transparent 34%),
          var(--bg);
        background-size: 44px 44px, 44px 44px, auto, auto, auto;
      }

      .shell {
        width: min(1180px, calc(100vw - 28px));
        margin: 20px auto 36px;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 800;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 14px;
        background: var(--cream);
        border: 1px solid var(--line);
        color: var(--mint-deep);
      }

      .admin-link {
        color: var(--muted);
        font-size: 13px;
        text-decoration: none;
      }

      .app-grid {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr) 340px;
        gap: 18px;
        align-items: start;
      }

      .panel {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
      }

      .hero-panel {
        padding: 24px;
      }

      .bubble {
        position: relative;
        display: inline-block;
        padding: 12px 16px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: #6a8589;
        font-weight: 700;
      }

      .bubble::after {
        content: "";
        position: absolute;
        left: 34px;
        bottom: -9px;
        width: 16px;
        height: 16px;
        background: #fff;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        transform: rotate(45deg);
      }

      .mascot {
        width: 230px;
        height: 230px;
        margin: 24px auto 8px;
      }

      .mascot svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      h1 {
        margin: 12px 0 8px;
        font-size: 32px;
        line-height: 1.25;
      }

      .lead {
        color: #6c7f83;
        font-weight: 700;
        line-height: 1.75;
      }

      form {
        display: grid;
        gap: 14px;
        margin-top: 20px;
      }

      .field {
        display: grid;
        gap: 7px;
      }

      label {
        font-size: 13px;
        font-weight: 800;
        color: #6a7e82;
      }

      input, select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 14px 15px;
        background: #fff;
        color: var(--ink);
        font: inherit;
      }

      .type-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }

      .type-option {
        display: grid;
        place-items: center;
        gap: 5px;
        min-height: 72px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
        color: #6a7e82;
        font-size: 12px;
        cursor: pointer;
      }

      .type-option input {
        display: none;
      }

      .type-option:has(input:checked) {
        background: var(--mint-soft);
        border-color: var(--mint-deep);
        color: #438c7b;
      }

      .icon {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 14px;
        background: var(--cream);
      }

      .days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 7px;
      }

      .days label {
        display: grid;
        place-items: center;
        aspect-ratio: 1;
        border: 1px solid var(--line);
        border-radius: 50%;
        background: #fff;
        color: #7f9296;
        cursor: pointer;
      }

      .days input {
        display: none;
      }

      .days label.active {
        background: var(--mint);
        border-color: var(--mint-deep);
        color: #347f74;
      }

      .hint {
        color: var(--muted);
        font-size: 12px;
      }

      .save-button {
        border: 0;
        border-radius: 999px;
        padding: 15px 18px;
        background: linear-gradient(180deg, #9de1d7, var(--mint-deep));
        color: #fff;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 12px 22px rgba(108, 200, 187, 0.28);
      }

      .list-panel {
        padding: 18px;
      }

      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .section-title strong {
        font-size: 18px;
      }

      .reminder-list {
        display: grid;
        gap: 12px;
      }

      .reminder-card {
        position: relative;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        padding: 14px 64px 46px 14px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: #fff;
      }

      .reminder-meta {
        display: grid;
        gap: 5px;
      }

      .reminder-name {
        font-weight: 900;
      }

      .reminder-time {
        color: var(--mint-deep);
        font-size: 28px;
        font-weight: 900;
        line-height: 1;
      }

      .weekday-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 4px;
      }

      .weekday-pill {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--mint-soft);
        color: #60958e;
        font-size: 11px;
        font-weight: 800;
      }

      .switch {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 44px;
        height: 26px;
        border-radius: 999px;
        background: var(--mint);
      }

      .delete-button {
        position: absolute;
        right: 14px;
        bottom: 12px;
        border: 0;
        border-radius: 999px;
        padding: 7px 12px;
        background: #fff2ef;
        color: #d6786f;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .switch::after {
        content: "";
        position: absolute;
        top: 3px;
        right: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 8px rgba(83, 102, 107, 0.14);
      }

      .empty {
        padding: 16px;
        border: 1px dashed var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.68);
        color: var(--muted);
      }

      .phone-panel {
        padding: 16px;
      }

      .phone {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 30px;
        background: #effbf8;
        box-shadow: inset 0 0 0 8px #ffffff;
      }

      .phone-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 20px 12px;
        color: #6a8589;
        font-weight: 900;
      }

      .chat-area {
        min-height: 430px;
        padding: 18px 18px 22px;
        background:
          radial-gradient(circle at 28% 20%, #ffffff 0 9%, transparent 10%),
          linear-gradient(180deg, #e9fbf7, #f8fffd);
      }

      .bot-row {
        display: grid;
        grid-template-columns: 38px 1fr;
        gap: 9px;
        align-items: end;
      }

      .avatar {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #fff;
        border: 1px solid var(--line);
      }

      .chat-bubble {
        width: fit-content;
        max-width: 230px;
        padding: 13px 15px;
        border-radius: 18px 18px 18px 5px;
        background: #fff;
        border: 1px solid #e4f6f3;
        color: #52686c;
        line-height: 1.7;
        font-weight: 700;
      }

      .quick-reply {
        width: fit-content;
        margin: 10px 0 0 47px;
        border: 0;
        border-radius: 999px;
        padding: 11px 28px;
        background: var(--mint-deep);
        color: #fff;
        font: inherit;
        font-weight: 900;
      }

      .user-bubble {
        width: fit-content;
        margin: 24px 0 18px auto;
        padding: 10px 14px;
        border-radius: 18px 18px 5px 18px;
        background: #a3e3d9;
        color: #fff;
        font-weight: 900;
      }

      @media (max-width: 1060px) {
        .app-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">♡</div>
          <span>やさしい習慣リマインダー</span>
        </div>
        <a class="admin-link" href="/api/admin">管理者設定</a>
      </header>

      <section class="app-grid">
        <section class="panel hero-panel">
          <div class="bubble">いっしょに いい習慣つくろうね ♡</div>
          <div class="mascot" aria-hidden="true">
            <svg viewBox="0 0 220 220" role="img">
              <defs>
                <radialGradient id="faceGlow" cx="38%" cy="28%" r="74%">
                  <stop offset="0%" stop-color="#fbffff" />
                  <stop offset="52%" stop-color="#d9f7f3" />
                  <stop offset="100%" stop-color="#afe5dd" />
                </radialGradient>
                <linearGradient id="poncho" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#fffdf8" />
                  <stop offset="100%" stop-color="#f4eee3" />
                </linearGradient>
                <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="12" stdDeviation="8" flood-color="#8fd7d0" flood-opacity="0.22" />
                </filter>
              </defs>
              <circle cx="56" cy="56" r="7" fill="#ffe890" opacity="0.9" />
              <circle cx="172" cy="72" r="7" fill="#ffe890" opacity="0.9" />
              <g filter="url(#softShadow)">
                <path d="M58 98 C24 96 12 122 28 140 C44 158 82 142 91 122 Z" fill="#c8f0eb" />
                <path d="M162 98 C196 96 208 122 192 140 C176 158 138 142 129 122 Z" fill="#c8f0eb" />
                <path d="M66 142 C66 114 154 114 154 142 L154 177 C154 191 142 198 110 198 C78 198 66 191 66 177 Z" fill="url(#poncho)" />
                <path d="M86 154 Q110 170 134 154" fill="none" stroke="#d9ccb7" stroke-width="2" opacity="0.42" />
                <ellipse cx="110" cy="104" rx="65" ry="58" fill="url(#faceGlow)" />
                <path d="M110 49 L107 25" stroke="#8fd7c8" stroke-width="6" stroke-linecap="round" />
                <path d="M108 28 C91 24 82 31 78 43 C94 44 104 39 108 28 Z" fill="#a7e3d7" />
                <path d="M112 28 C129 24 138 31 142 43 C126 44 116 39 112 28 Z" fill="#a7e3d7" />
                <circle cx="85" cy="105" r="17" fill="#2d3f46" />
                <circle cx="135" cy="105" r="17" fill="#2d3f46" />
                <circle cx="79" cy="98" r="6" fill="#ffffff" opacity="0.9" />
                <circle cx="129" cy="98" r="6" fill="#ffffff" opacity="0.9" />
                <ellipse cx="70" cy="130" rx="16" ry="9" fill="#f4aaa2" opacity="0.55" />
                <ellipse cx="150" cy="130" rx="16" ry="9" fill="#f4aaa2" opacity="0.55" />
                <path d="M101 126 Q110 134 119 126" fill="none" stroke="#53696f" stroke-width="3" stroke-linecap="round" />
                <circle cx="78" cy="165" r="16" fill="#bceee8" />
                <circle cx="142" cy="165" r="16" fill="#bceee8" />
                <rect x="50" y="142" width="28" height="34" rx="9" fill="#ffffff" opacity="0.94" stroke="#bfeeea" stroke-width="3" />
                <text x="64" y="164" text-anchor="middle" fill="#f0a7a0" font-size="18" font-family="sans-serif">♡</text>
              </g>
            </svg>
          </div>
          <h1>祐希ちゃん本人が、LINEで小さな習慣を登録。</h1>
          <p class="lead">佑哉さんはサーバー運営だけ。内容や時間は管理画面に表示しません。</p>

          <div class="field">
            <label>LINEで送る例</label>
            <div class="chat-bubble">重曹クエン酸水 8:00</div>
            <div class="hint">確認カードが出たら「登録する」を押すだけです。</div>
          </div>
          <div class="field">
            <label>一覧・削除</label>
            <div class="chat-bubble">一覧</div>
            <div class="hint">本人のLINEだけに一覧が届き、そこから削除できます。</div>
          </div>
        </section>

        <section class="panel list-panel">
          <div class="section-title">
            <strong>登録したリマインダー</strong>
            <span class="hint">ON/OFFはカード右上</span>
          </div>
          <div class="reminder-list" id="list"></div>
        </section>

        <section class="panel phone-panel">
          <div class="phone">
            <div class="phone-head">
              <span>LINE</span>
              <span>⋯</span>
            </div>
            <div class="chat-area">
              <div class="bot-row">
                <div class="avatar">♡</div>
                <div class="chat-bubble">祐希ちゃん、そろそろだよ<br />重曹クエン酸水、飲めそう？</div>
              </div>
              <button class="quick-reply" type="button">飲んだよ</button>
              <div class="user-bubble">飲んだよ</div>
              <div class="bot-row">
                <div class="avatar">♡</div>
                <div class="chat-bubble">記録したよ。いいこいいこ。</div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
    <script>
      const form = document.getElementById("reminder-form");
      const list = document.getElementById("list");
      const lineUserSelect = document.getElementById("lineUserId");
      const dayLabels = Array.from(document.querySelectorAll(".days label"));
      const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

      dayLabels.forEach((label) => {
        const input = label.querySelector("input");
        const sync = () => label.classList.toggle("active", input.checked);
        input.addEventListener("change", sync);
        sync();
      });

      function iconFor(category) {
        if (category === "medicine") return "💊";
        if (category === "supplement") return "⭐";
        if (category === "other") return "♡";
        return "🥤";
      }

      function kindFor(category) {
        return category === "other" ? "task" : "drink";
      }

      function actionLabelFor(category) {
        return category === "other" ? "やったよ" : "飲んだよ";
      }

      function dayPills(days) {
        const selected = days && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
        return selected.map((day) => "<span class=\"weekday-pill\">" + weekdayNames[day] + "</span>").join("");
      }

      async function loadReminders() {
        try {
          const response = await fetch("/api/reminders");
          if (!response.ok) throw new Error("failed");
          const data = await response.json();
          list.innerHTML = "";

          if (!data.reminders.length) {
            list.innerHTML = "<div class=\"empty\">まだリマインダーはありません。</div>";
            return;
          }

          for (const reminder of data.reminders) {
            const item = document.createElement("div");
            const category = reminder.category || "other";
            item.className = "reminder-card";
            item.innerHTML =
              "<div class=\"icon\">" + iconFor(category) + "</div>" +
              "<div class=\"reminder-meta\">" +
                "<div class=\"reminder-name\">非公開リマインダー</div>" +
                "<div class=\"reminder-time\">内容・時間は本人のLINEだけ</div>" +
                "<div class=\"weekday-row\"><span class=\"weekday-pill\">PRIVATE</span></div>" +
              "</div>" +
              "<div class=\"switch\" aria-label=\"通知ON\"></div>" +
              "<button class=\"delete-button\" type=\"button\" disabled>LINEで削除</button>";
            list.appendChild(item);
          }
        } catch (_error) {
          list.innerHTML = "<div class=\"empty\">Supabaseをつなぐと一覧が表示されます。</div>";
        }
      }

      list.addEventListener("click", async (event) => {
        const button = event.target.closest(".delete-button");
        if (!button) return;

        if (!confirm("このリマインダーを削除する？")) {
          return;
        }

        const response = await fetch("/api/reminders?id=" + encodeURIComponent(button.dataset.id), {
          method: "DELETE"
        });

        if (!response.ok) {
          alert("削除に失敗したよ");
          return;
        }

        await loadReminders();
      });

      async function loadLineUsers() {
        if (!lineUserSelect) return;
        try {
          const response = await fetch("/api/line-users");
          if (!response.ok) throw new Error("failed");
          const data = await response.json();
          lineUserSelect.innerHTML = "";
          if (!data.lineUsers.length) {
            lineUserSelect.innerHTML = "<option value=\"\">友だち追加後に選べるよ</option>";
            return;
          }

          for (const lineUser of data.lineUsers) {
            const option = document.createElement("option");
            option.value = lineUser.line_user_id;
            option.textContent = "祐希ちゃん " + lineUser.line_user_id.slice(0, 8) + "...";
            lineUserSelect.appendChild(option);
          }
        } catch (_error) {
          lineUserSelect.innerHTML = "<option value=\"\">LINE設定後に選べるよ</option>";
        }
      }

      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
        const formData = new FormData(form);
        const category = String(formData.get("category") || "drink");
        const daysOfWeek = Array.from(document.querySelectorAll(".days input:checked")).map((input) => Number(input.value));
        const payload = {
          title: formData.get("title"),
          time: formData.get("time"),
          daysOfWeek,
          enabled: true,
          category,
          kind: kindFor(category),
          actionLabel: actionLabelFor(category),
          lineUserId: formData.get("lineUserId")
        };

        const response = await fetch("/api/reminders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          alert("保存に失敗したよ");
          return;
        }

        form.reset();
        dayLabels.forEach((label) => label.classList.remove("active"));
          await loadReminders();
        });
      }

      loadLineUsers();
      loadReminders();
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
