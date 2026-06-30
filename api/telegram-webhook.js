import { getDoc, updateDoc, queryDocs } from './_firestore.js';

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID  = process.env.TELEGRAM_CHANNEL_ID;
const ADMIN_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;
const GROUP_CHAT  = process.env.TELEGRAM_GROUP_CHAT_ID;

// Destinazione notifiche: gruppo se configurato, altrimenti privato admin
const NOTIFY_CHAT = GROUP_CHAT || ADMIN_CHAT;

function isAuthorized(fromId) {
  return String(fromId) === String(ADMIN_CHAT);
}

async function tgAnswer(callbackQueryId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
}

async function tgSend(chatId, text, extra = {}) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
  return r.json();
}

async function tgEditMessage(chatId, messageId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
  });
}

async function tgSendToChannel(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: 'HTML' }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;

  // ── Bottoni inline ───────────────────────────────────
  if (body.callback_query) {
    const cq     = body.callback_query;
    const data   = cq.data || '';
    const chatId = cq.message.chat.id;
    const msgId  = cq.message.message_id;
    const fromId = String(cq.from.id);

    if (!isAuthorized(fromId)) {
      await tgAnswer(cq.id, '❌ Non autorizzato');
      return res.status(200).json({ ok: true });
    }

    const colonIdx = data.indexOf(':');
    const action    = data.slice(0, colonIdx);
    const pendingId = data.slice(colonIdx + 1);

    // ── INVIA ──
    if (action === 'send') {
      const pending = await getDoc('pending_notifications', pendingId);
      if (!pending) {
        await tgAnswer(cq.id, '⚠️ Notifica non trovata');
        return res.status(200).json({ ok: true });
      }
      if (pending.status === 'sent') {
        await tgAnswer(cq.id, '✅ Già inviato');
        return res.status(200).json({ ok: true });
      }
      const ok = await tgSendToChannel(pending.channelMsg);
      if (ok) {
        await updateDoc('pending_notifications', pendingId, { status: 'sent', editMode: false });
        await tgAnswer(cq.id, '✅ Inviato al canale!');
        await tgEditMessage(chatId, msgId, `${cq.message.text || ''}\n\n<b>✅ INVIATO AL CANALE</b>`);
      } else {
        await tgAnswer(cq.id, '❌ Errore. Controlla che il bot sia admin del canale.');
      }
    }

    // ── MODIFICA ──
    if (action === 'modify') {
      const pending = await getDoc('pending_notifications', pendingId);
      if (!pending) {
        await tgAnswer(cq.id, '⚠️ Notifica non trovata');
        return res.status(200).json({ ok: true });
      }
      // Salva stato "in attesa di testo modificato"
      await updateDoc('pending_notifications', pendingId, { editMode: true });
      await tgAnswer(cq.id, '✏️ Scrivi il nuovo testo');
      await tgSend(chatId,
        `✏️ <b>Modifica il messaggio</b>\n\nTesto attuale:\n<blockquote>${pending.channelMsg}</blockquote>\n\n👇 Rispondi con il nuovo testo da inviare al canale:`,
        { reply_markup: { force_reply: true, selective: true } }
      );
    }

    // ── IGNORA ──
    if (action === 'ignore') {
      await updateDoc('pending_notifications', pendingId, { status: 'ignored', editMode: false });
      await tgAnswer(cq.id, '❌ Ignorato');
      await tgEditMessage(chatId, msgId, `${cq.message.text || ''}\n\n<i>❌ Ignorato</i>`);
    }

    return res.status(200).json({ ok: true });
  }

  // ── Messaggi di testo dall'admin ─────────────────────
  if (body.message) {
    const msg    = body.message;
    const chatId = String(msg.chat.id);
    const fromId = String(msg.from?.id);
    const text   = msg.text || '';

    // /start
    if (text === '/start') {
      await tgSend(chatId, '👋 Ciao! Sono il bot di DodicesimoUomo.\nTi notificherò gli eventi live delle partite monitorate.');
      return res.status(200).json({ ok: true });
    }

    // Testo modificato dall'admin (risposta a modifica) — funziona sia in privato che nel gruppo
    if (isAuthorized(fromId) && text && !text.startsWith('/')) {
      const editPending = await queryDocs('pending_notifications', 'editMode', 'EQUAL', true);
      if (editPending.length > 0) {
        const pending = editPending[0];
        await updateDoc('pending_notifications', pending.id, {
          channelMsg: text,
          editMode:   false,
        });
        await tgSend(NOTIFY_CHAT,
          `✅ <b>Testo aggiornato!</b>\n\n<blockquote>${text}</blockquote>`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ INVIA AL CANALE', callback_data: `send:${pending.id}` },
                { text: '✏️ Modifica ancora', callback_data: `modify:${pending.id}` },
                { text: '❌ Ignora',          callback_data: `ignore:${pending.id}` },
              ]],
            },
          }
        );
        return res.status(200).json({ ok: true });
      }
    }
  }

  return res.status(200).json({ ok: true });
}
