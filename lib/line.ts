import crypto from "node:crypto";
import { messagingApi } from "@line/bot-sdk";
import type { messagingApi as LineMessagingApi } from "@line/bot-sdk";
import { getLineEnv } from "./env.js";
import type { DoseLogHistoryEntry, ReminderCategory, ReminderRow } from "./types.js";

const lineEnv = getLineEnv();
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: lineEnv.lineChannelAccessToken
});

type LineMessage = LineMessagingApi.Message;

export type ReminderDraft = {
  title: string;
  time: string;
  daysOfWeek: number[] | null;
  category: ReminderCategory;
  actionLabel: "飲んだよ" | "やったよ";
};

const dayOfWeekLabels = ["日", "月", "火", "水", "木", "金", "土"];

function formatDaysOfWeek(daysOfWeek: number[]) {
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((day) => dayOfWeekLabels[day])
    .filter(Boolean)
    .join("・");
}

function reminderFlexMessage(reminderId: string, actionLabel: string): LineMessage {
  const postbackData = JSON.stringify({
    type: "record-reminder",
    reminderId
  });

  return {
    type: "flex",
    altText: "祐希ちゃん、そろそろだよ\n飲めそう？",
    contents: {
      type: "bubble",
      size: "mega",
      styles: {
        body: {
          backgroundColor: "#F8FFFC"
        },
        footer: {
          backgroundColor: "#F8FFFC"
        }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "24px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "祐希ちゃん、そろそろだよ",
            size: "lg",
            color: "#60757A",
            weight: "bold",
            wrap: true,
            margin: "lg"
          },
          {
            type: "text",
            text: "飲めそう？",
            size: "xl",
            color: "#60757A",
            weight: "bold",
            wrap: true
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFF8EA",
            cornerRadius: "xl",
            paddingAll: "18px",
            margin: "md",
            contents: [
              {
                type: "text",
                text: "そっと見守ってるよ🪼",
                size: "md",
                color: "#4F6469",
                weight: "bold",
                wrap: true
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#7CCFC4",
            height: "md",
            action: {
              type: "postback",
              label: `${actionLabel}！`,
              data: postbackData,
              displayText: actionLabel
            }
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "あとで",
              data: JSON.stringify({ type: "snooze-reminder", reminderId }),
              displayText: "あとで"
            }
          }
        ]
      }
    }
  };
}

function recordedFlexMessage(): LineMessage {
  return {
    type: "flex",
    altText: "いいこ、いいこ、よくできました。",
    contents: {
      type: "bubble",
      size: "kilo",
      styles: {
        body: {
          backgroundColor: "#F8FFFC"
        }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "22px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "いいこ、いいこ、",
            size: "lg",
            weight: "bold",
            color: "#4F6469",
            wrap: true
          },
          {
            type: "text",
            text: "よくできました。✨",
            size: "lg",
            weight: "bold",
            color: "#6F858A",
            wrap: true
          },
          {
            type: "text",
            text: "今日もいい日になるよ〜🌱",
            size: "md",
            color: "#79BFB4",
            wrap: true
          }
        ]
      }
    }
  };
}

function categoryIcon(category: ReminderCategory) {
  if (category === "medicine") return "💊";
  if (category === "supplement") return "⭐";
  if (category === "other") return "♡";
  return "🥤";
}

function reminderDraftPostback(draft: ReminderDraft) {
  return JSON.stringify({
    type: "create-reminder",
    title: draft.title,
    time: draft.time,
    daysOfWeek: draft.daysOfWeek,
    category: draft.category,
    actionLabel: draft.actionLabel
  });
}

function registrationConfirmFlexMessage(draft: ReminderDraft): LineMessage {
  return {
    type: "flex",
    altText: `この内容で登録する？\n${draft.title} ${draft.time}`,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: {
        body: { backgroundColor: "#F8FFFC" },
        footer: { backgroundColor: "#F8FFFC" }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "22px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "この内容で登録する？🌱",
            size: "lg",
            weight: "bold",
            color: "#4F6469",
            wrap: true
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFF8EA",
            cornerRadius: "xl",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: `${categoryIcon(draft.category)} ${draft.title}`,
                size: "md",
                weight: "bold",
                color: "#4F6469",
                wrap: true
              },
              {
                type: "text",
                text: draft.time,
                size: "xl",
                weight: "bold",
                color: "#6CC8BB",
                margin: "sm"
              },
              {
                type: "text",
                text:
                  draft.daysOfWeek && draft.daysOfWeek.length > 0
                    ? `毎週 ${formatDaysOfWeek(draft.daysOfWeek)} にお知らせするよ`
                    : "毎日お知らせするよ",
                size: "sm",
                color: "#7D9398",
                margin: "sm",
                wrap: true
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#7CCFC4",
            action: {
              type: "postback",
              label: "登録する",
              data: reminderDraftPostback(draft),
              displayText: "登録する"
            }
          }
        ]
      }
    }
  };
}

function registrationDoneFlexMessage(draft: ReminderDraft): LineMessage {
  const scheduleText =
    draft.daysOfWeek && draft.daysOfWeek.length > 0
      ? `毎週 ${formatDaysOfWeek(draft.daysOfWeek)} の${draft.time}にそっとお知らせするね。`
      : `${draft.time}にそっとお知らせするね。`;

  return {
    type: "flex",
    altText:
      draft.daysOfWeek && draft.daysOfWeek.length > 0
        ? `登録したよ。毎週 ${formatDaysOfWeek(draft.daysOfWeek)} の${draft.time}にお知らせするね。`
        : `登録したよ。${draft.time}にお知らせするね。`,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: {
        body: { backgroundColor: "#F8FFFC" }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "22px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "登録したよ🌱",
            size: "lg",
            weight: "bold",
            color: "#4F6469"
          },
          {
            type: "text",
            text: scheduleText,
            size: "md",
            color: "#6F858A",
            wrap: true
          }
        ]
      }
    }
  };
}

function reminderListFlexMessage(reminders: ReminderRow[]): LineMessage {
  if (reminders.length === 0) {
    return {
      type: "text",
      text: "まだリマインダーはないよ。\n例：重曹クエン酸水 8:00\nみたいに送ると登録できるよ🌱"
    };
  }

  return {
    type: "flex",
    altText: "登録しているリマインダーだよ",
    contents: {
      type: "carousel",
      contents: reminders.slice(0, 10).map((reminder) => ({
        type: "bubble",
        size: "kilo",
        styles: {
          body: { backgroundColor: "#F8FFFC" },
          footer: { backgroundColor: "#F8FFFC", separator: true, separatorColor: "#E4F6F3" }
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "16px",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: `${categoryIcon(reminder.category)} ${reminder.title}`,
              size: "sm",
              weight: "bold",
              color: "#4F6469",
              wrap: true
            },
            {
              type: "text",
              text: reminder.time,
              size: "xxl",
              weight: "bold",
              color: "#6CC8BB"
            },
            {
              type: "text",
              text:
                reminder.days_of_week && reminder.days_of_week.length > 0
                  ? formatDaysOfWeek(reminder.days_of_week)
                  : "毎日",
              size: "xs",
              color: "#7D9398"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "12px",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  flex: 1,
                  action: {
                    type: "postback",
                    label: "時間を変える",
                    data: JSON.stringify({ type: "edit-reminder-time", reminderId: reminder.id }),
                    displayText: "時間を変える"
                  }
                },
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  flex: 1,
                  action: {
                    type: "postback",
                    label: "曜日を変える",
                    data: JSON.stringify({ type: "edit-reminder-days", reminderId: reminder.id }),
                    displayText: "曜日を変える"
                  }
                }
              ]
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              color: "#FFF2EF",
              action: {
                type: "postback",
                label: "削除する",
                data: JSON.stringify({ type: "delete-reminder", reminderId: reminder.id }),
                displayText: "削除する"
              }
            }
          ]
        }
      }))
    }
  };
}

export async function pushReminder(lineUserId: string, reminderId: string, title: string, actionLabel: string) {
  await lineClient.pushMessage({
    to: lineUserId,
    messages: [reminderFlexMessage(reminderId, actionLabel)]
  });
}

export async function pushLineTest(lineUserId: string) {
  await lineClient.pushMessage({
    to: lineUserId,
    messages: [
      {
        type: "text",
        text: "佑哉さん、テスト通知だよ🌱\nここまで届けばLINE接続OKです。"
      }
    ]
  });
}

export async function replyRecorded(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [recordedFlexMessage()]
  });
}

export async function replyRegistrationConfirm(replyToken: string, draft: ReminderDraft) {
  await lineClient.replyMessage({
    replyToken,
    messages: [registrationConfirmFlexMessage(draft)]
  });
}

export async function replyRegistrationDone(replyToken: string, draft: ReminderDraft) {
  await lineClient.replyMessage({
    replyToken,
    messages: [registrationDoneFlexMessage(draft)]
  });
}

export async function replyReminderList(replyToken: string, reminders: ReminderRow[]) {
  await lineClient.replyMessage({
    replyToken,
    messages: [reminderListFlexMessage(reminders)]
  });
}

export async function replyReminderDeleted(replyToken: string, deletedDraft?: ReminderDraft) {
  if (!deletedDraft) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "削除したよ🌱"
        }
      ]
    });
    return;
  }

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "flex",
        altText: "削除したよ🌱",
        contents: {
          type: "bubble",
          size: "kilo",
          styles: {
            body: { backgroundColor: "#F8FFFC" },
            footer: { backgroundColor: "#F8FFFC" }
          },
          body: {
            type: "box",
            layout: "vertical",
            paddingAll: "22px",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "削除したよ🌱",
                size: "lg",
                weight: "bold",
                color: "#4F6469",
                wrap: true
              },
              {
                type: "text",
                text: "まちがえて消しちゃったときは、下から戻せるよ。",
                size: "sm",
                color: "#7D9398",
                wrap: true
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "18px",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "もとに戻す",
                  data: reminderDraftPostback(deletedDraft),
                  displayText: "もとに戻す"
                }
              }
            ]
          }
        }
      }
    ]
  });
}

export async function replySnoozed(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "わかったよ🌼\n15分くらいしたら、またそっと声かけるね。"
      }
    ]
  });
}

function timePickerQuickReply(postbackType: "reg-time" | "edit-time-pick"): LineMessagingApi.QuickReply {
  return {
    items: [
      {
        type: "action",
        action: {
          type: "datetimepicker",
          label: "時間をえらぶ",
          data: JSON.stringify({ type: postbackType }),
          mode: "time"
        }
      }
    ]
  };
}

function daysQuickReply(postbackType: "reg-days" | "edit-days"): LineMessagingApi.QuickReply {
  const presets: Array<{ label: string; days: number[] | null }> = [
    { label: "毎日", days: null },
    { label: "平日", days: [1, 2, 3, 4, 5] },
    { label: "週末", days: [0, 6] },
    ...[1, 2, 3, 4, 5, 6, 0].map((day) => ({ label: dayOfWeekLabels[day], days: [day] }))
  ];

  return {
    items: presets.map((preset) => ({
      type: "action" as const,
      action: {
        type: "postback" as const,
        label: preset.label,
        data: JSON.stringify({ type: postbackType, days: preset.days }),
        displayText: preset.label
      }
    }))
  };
}

export async function replyAskTime(replyToken: string, title: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `「${title}」を登録するね🪼\n何時にお知らせする？\n下の「時間をえらぶ」から選んでね。\n8:00 みたいに送ってもいいよ。`,
        quickReply: timePickerQuickReply("reg-time")
      }
    ]
  });
}

export async function replyAskDays(replyToken: string, time: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `${time}だね🪼\nどの曜日にお知らせする？\n下から選んでね。\n「月水金」みたいに送ってもいいよ。`,
        quickReply: daysQuickReply("reg-days")
      }
    ]
  });
}

export async function replyRestartRegistration(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "ごめんね、とちゅうでわからなくなっちゃった🪼\nもう一度、登録したい名前だけ送ってね。"
      }
    ]
  });
}

export async function replyEditTimePrompt(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "新しい時間を送ってね🌱\n下の「時間をえらぶ」からも選べるよ。\n例：9:30",
        quickReply: timePickerQuickReply("edit-time-pick")
      }
    ]
  });
}

export async function replyEditDaysPrompt(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "どの曜日にお知らせする？🌱\n下から選んでね。\n「月水金」みたいに送ってもいいよ。",
        quickReply: daysQuickReply("edit-days")
      }
    ]
  });
}

export async function replyDaysUpdated(replyToken: string, daysOfWeek: number[] | null) {
  const scheduleText =
    daysOfWeek && daysOfWeek.length > 0
      ? `毎週 ${formatDaysOfWeek(daysOfWeek)} にお知らせするね。`
      : "毎日お知らせするね。";

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `変えたよ🌱\n${scheduleText}`
      }
    ]
  });
}

export async function replyTimeUpdated(replyToken: string, time: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `変えたよ🌱\n${time}にお知らせするね。`
      }
    ]
  });
}

export async function replyReminderNotFound(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "ごめんね、そのリマインダーが見つからなかったよ。\n「一覧」で確認してみてね🌱"
      }
    ]
  });
}

export async function replyFeatureNotReady(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "ごめんね、この機能はまだ準備中みたい。\nもう少しだけ待っててね🌱"
      }
    ]
  });
}

function formatTakenAtInTokyo(takenAt: string) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(takenAt));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const hour = String(Number(part("hour")));
  return `${part("month")}/${part("day")}(${part("weekday")}) ${hour}:${part("minute")}`;
}

export async function replyDoseLogHistory(replyToken: string, entries: DoseLogHistoryEntry[]) {
  if (entries.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "まだきろくはないよ。\nお知らせが届いたらボタンを押してね🌱"
        }
      ]
    });
    return;
  }

  const lines = entries.map((entry) => `${formatTakenAtInTokyo(entry.taken_at)} ✅ ${entry.title}`);

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `最近のきろくだよ🌱\n\n${lines.join("\n")}`
      }
    ]
  });
}

export async function replyUsage(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "LINEだけで登録できるよ🌱\n\n例：\n重曹クエン酸水 8:00\n夜のおくすり 20:30\n\n名前だけ（例：おくすり）を送ると、\n時間と曜日をボタンで選べるよ。\n\n確認が出たら「登録する」を押してね。\n一覧を見るときは「一覧」って送ってね。\nきろくを見るときは「きろく」って送ってね。\nお知らせの「あとで」を押すと、15分後にもう一度お知らせするよ。\n一覧の「時間を変える」から時間も直せるよ。\n一覧の「曜日を変える」から曜日も直せるよ。"
      }
    ]
  });
}

export async function replyLinked(replyToken: string, lineUserId?: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: lineUserId
          ? `つながったよ。これからやさしくお知らせするね。\n\nテスト用ID:\n${lineUserId}`
          : "つながったよ。これからやさしくお知らせするね。"
      }
    ]
  });
}

export function verifyLineSignature(rawBody: string, signature: string | undefined) {
  if (!signature) {
    return false;
  }

  const digest = crypto
    .createHmac("SHA256", lineEnv.lineChannelSecret)
    .update(rawBody)
    .digest("base64");

  const digestBuffer = Buffer.from(digest);
  const signatureBuffer = Buffer.from(signature);

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}
