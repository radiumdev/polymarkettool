/**
 * PolyCopy Telegram Bot — Alert + Approve/Reject via inline buttons
 * Uses raw Telegram Bot API (no npm deps needed)
 */

const TG_API = "https://api.telegram.org/bot";

let BOT_TOKEN = "";
let CHAT_ID = "";
let lastUpdateId = 0;

export function initTelegram(token: string, chatId: string) {
  BOT_TOKEN = token;
  CHAT_ID = chatId;
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] No TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — alerts disabled");
    return false;
  }
  console.log(`[Telegram] Initialized | Chat: ${CHAT_ID} | Token: ${BOT_TOKEN.slice(0, 8)}...`);
  return true;
}

export function isEnabled() { return !!(BOT_TOKEN && CHAT_ID); }

async function tgFetch(method: string, body?: any): Promise<any> {
  try {
    const res = await fetch(`${TG_API}${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.log(`[Telegram] ${method} failed: ${res.status} ${txt.slice(0, 100)}`);
      return null;
    }
    return res.json();
  } catch (e: any) {
    console.log(`[Telegram] ${method} error: ${e.message?.slice(0, 80)}`);
    return null;
  }
}

// ── Send a text message ─────────────────────────────────────
export async function sendMessage(text: string, replyMarkup?: any): Promise<number | null> {
  if (!isEnabled()) return null;
  const result = await tgFetch("sendMessage", {
    chat_id: CHAT_ID,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return result?.result?.message_id || null;
}

// ── Edit an existing message (remove buttons after action) ──
async function editMessage(messageId: number, text: string) {
  if (!isEnabled()) return;
  await tgFetch("editMessageText", {
    chat_id: CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  });
}

// ── Answer callback query (dismiss loading state) ───────────
async function answerCallback(callbackId: string, text: string) {
  await tgFetch("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: false,
  });
}

// ── Send trade alert with Approve/Reject buttons ────────────
export async function sendTradeAlert(trade: {
  id: string;
  traderLabel: string;
  market: string;
  outcome: string;
  side: string;
  copySize: number;
  originalSize: number;
  originalPrice: number;
  conviction?: number;
  convictionNote?: string;
}): Promise<number | null> {
  const convBadge = trade.conviction && trade.conviction > 0 ? ` 🔥 x${trade.conviction}` : "";
  const sideEmoji = trade.side === "BUY" ? "🟢" : "🔴";

  const text = [
    `${sideEmoji} <b>New Whale Trade</b>${convBadge}`,
    ``,
    `👤 <b>${escHtml(trade.traderLabel)}</b>`,
    `📊 ${escHtml(trade.market)}`,
    `🎯 <b>${trade.side}</b> ${trade.outcome} @ ${trade.originalPrice.toFixed(3)}`,
    `💰 Whale: $${trade.originalSize.toFixed(2)} → Copy: <b>$${trade.copySize.toFixed(2)}</b>`,
    trade.convictionNote ? `\n${trade.convictionNote}` : "",
  ].filter(Boolean).join("\n");

  const replyMarkup = {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve:${trade.id}` },
      { text: "❌ Reject", callback_data: `reject:${trade.id}` },
    ]],
  };

  return sendMessage(text, replyMarkup);
}

// ── Send filter notification (lighter, no buttons) ──────────
export async function sendFilterNotice(trade: {
  traderLabel: string;
  market: string;
  side: string;
  originalSize: number;
  skipReason: string;
}) {
  if (!isEnabled()) return;
  // Only send filter notices for trades > $500 (to avoid spam)
  if (trade.originalSize < 500) return;

  const text = [
    `🚫 <b>Filtered</b>`,
    `${escHtml(trade.traderLabel)}: ${trade.side} $${trade.originalSize.toFixed(0)} on "${escHtml(trade.market)}"`,
    `Reason: <i>${escHtml(trade.skipReason)}</i>`,
  ].join("\n");

  await sendMessage(text);
}

// ── Send execution confirmation ─────────────────────────────
export async function sendExecConfirmation(trade: {
  market: string;
  side: string;
  copySize: number;
  status: string;
}) {
  if (!isEnabled()) return;
  const emoji = trade.status === "executed" ? "✅" : trade.status === "dry_run" ? "📋" : "❌";
  const text = `${emoji} <b>${trade.status.toUpperCase()}</b>: ${trade.side} $${trade.copySize.toFixed(2)} on "${escHtml(trade.market)}"`;
  await sendMessage(text);
}

// ── Bot status notification ─────────────────────────────────
export async function sendStatus(msg: string) {
  if (!isEnabled()) return;
  await sendMessage(`ℹ️ ${escHtml(msg)}`);
}

// ── Poll for callback button presses ────────────────────────
// Returns array of { action: "approve"|"reject", tradeId: string }
export async function pollCallbacks(): Promise<{ action: string; tradeId: string; messageId: number; callbackId: string }[]> {
  if (!isEnabled()) return [];

  const result = await tgFetch("getUpdates", {
    offset: lastUpdateId + 1,
    timeout: 0, // non-blocking
    allowed_updates: ["callback_query"],
  });

  if (!result?.result?.length) return [];

  const actions: { action: string; tradeId: string; messageId: number; callbackId: string }[] = [];

  for (const update of result.result) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);

    const cb = update.callback_query;
    if (!cb?.data) continue;

    const [action, tradeId] = cb.data.split(":");
    if (!action || !tradeId) continue;

    actions.push({
      action,
      tradeId,
      messageId: cb.message?.message_id || 0,
      callbackId: cb.id,
    });

    // Acknowledge the callback immediately
    const emoji = action === "approve" ? "✅" : "❌";
    await answerCallback(cb.id, `${emoji} ${action === "approve" ? "Approved" : "Rejected"}!`);

    // Update the message to remove buttons and show result
    if (cb.message?.message_id) {
      const originalText = cb.message?.text || "";
      const statusLine = action === "approve"
        ? "\n\n✅ <b>APPROVED</b> — executing..."
        : "\n\n❌ <b>REJECTED</b>";
      await editMessage(cb.message.message_id, escHtml(originalText) + statusLine);
    }
  }

  return actions;
}

// ── HTML escape helper ──────────────────────────────────────
function escHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
