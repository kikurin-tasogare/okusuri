import crypto from "node:crypto";
import { messagingApi } from "@line/bot-sdk";
import type { messagingApi as LineMessagingApi } from "@line/bot-sdk";
import { getLineEnv } from "./env.js";
import type { ReminderCategory, ReminderRow } from "./types.js";

const lineEnv = getLineEnv();
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: lineEnv.lineChannelAccessToken
});

type LineMessage = LineMessagingApi.Message;

export type ReminderDraft = {
  title: string;
  time: string;
  category: ReminderCategory;
  actionLabel: "飲んだよ" | "やったよ";
};

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
            type: "box",
            layout: "vertical",
            backgroundColor: "#EAFBF7",
            cornerRadius: "xxl",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: "🌱 小さな相棒から",
                size: "sm",
                color: "#79BFB4",
                weight: "bold"
              }
            ]
          },
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
                text: "そっと見守ってるよ🌼",
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
                text: "毎日お知らせするよ",
                size: "sm",
                color: "#7D9398",
                margin: "sm"
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
  return {
    type: "flex",
    altText: `登録したよ。${draft.time}にお知らせするね。`,
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
            text: `${draft.time}にそっとお知らせするね。`,
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
        size: "micro",
        styles: {
          body: { backgroundColor: "#F8FFFC" },
          footer: { backgroundColor: "#F8FFFC" }
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
              size: "xl",
              weight: "bold",
              color: "#6CC8BB"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "12px",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
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

export async function replyReminderDeleted(replyToken: string) {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "削除したよ🌱"
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
        text: "LINEだけで登録できるよ🌱\n\n例：\n重曹クエン酸水 8:00\n夜のおくすり 20:30\n\n確認が出たら「登録する」を押してね。\n一覧を見るときは「一覧」って送ってね。"
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

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
