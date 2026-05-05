import type { Suggestion } from "@/types";
import type { SettingsState } from "@/store/useAppStore";
import type { SportsMispricing } from "@/lib/oddsApi";
import { getConfidenceColor } from "@/lib/confidenceColor";

interface TgParams { chatId: string; suggestion: Suggestion; crossMarketEdge?: string; }

export async function sendTelegramAlert({ chatId, suggestion, crossMarketEdge }: TgParams): Promise<boolean> {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  const text = [
    `*EdgeHunter Alert*`,
    ``,
    `*${suggestion.question}*`,
    ``,
    `Direction: ${suggestion.direction === "YES" ? "✅ YES" : "🔴 NO"}`,
    `Suggested: $${suggestion.suggestedAmount}`,
    `Confidence: ${suggestion.confidence}%`,
    `Edge: +${(suggestion.edge * 100).toFixed(1)}%`,
    ``,
    `_${suggestion.reasoning}_`,
    crossMarketEdge ? `\n📊 Cross-market: ${crossMarketEdge}` : "",
    `\n⚠️ Suggestion only — verify before trading`,
  ].join("\n");

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return resp.ok;
  } catch { return false; }
}

interface DcParams { webhookUrl: string; suggestion: Suggestion; }

export async function sendDiscordAlert({ webhookUrl, suggestion }: DcParams): Promise<boolean> {
  if (!webhookUrl) return false;
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🎯 " + suggestion.question,
          color: suggestion.direction === "YES" ? 0x10b981 : 0xef4444,
          fields: [
            { name: "Direction", value: suggestion.direction, inline: true },
            { name: "Suggested Amount", value: "$" + suggestion.suggestedAmount, inline: true },
            { name: "Confidence", value: suggestion.confidence + "%", inline: true },
            { name: "Edge", value: "+" + (suggestion.edge * 100).toFixed(1) + "%", inline: true },
            { name: "Reasoning", value: suggestion.reasoning, inline: false },
          ],
          footer: { text: "EdgeHunter — Suggestion only, not financial advice" },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return resp.ok;
  } catch { return false; }
}

export type AlertSettings = SettingsState["alerts"];

export async function dispatchAlert(
  suggestion: Suggestion,
  settings: SettingsState,
  crossMarketEdge?: string,
): Promise<{ telegram: boolean; discord: boolean; email: boolean }> {
  const out = { telegram: false, discord: false, email: false };
  if (suggestion.confidence < settings.alertThreshold) return out;
  const a = settings.alerts;
  if (a.telegram.enabled && a.telegram.chatId) {
    out.telegram = await sendTelegramAlert({ chatId: a.telegram.chatId, suggestion, crossMarketEdge });
  }
  if (a.discord.enabled && a.discord.webhookUrl) {
    out.discord = await sendDiscordAlert({ webhookUrl: a.discord.webhookUrl, suggestion });
  }
  if (a.email.enabled && a.email.address) {
    // Email requires backend; mark as queued
    out.email = false;
  }
  return out;
}

export async function sendSportsAlert(
  m: SportsMispricing,
  alertSettings: SettingsState["alerts"],
): Promise<{ telegram: boolean; discord: boolean }> {
  const out = { telegram: false, discord: false };
  const tgToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;

  const tgText = [
    `*EdgeHunter Sports Alert*`,
    ``,
    `${m.game.homeTeam} vs ${m.game.awayTeam}`,
    `League: ${m.league}`,
    ``,
    `Polymarket:  ${(m.polyImplied * 100).toFixed(1)}%`,
    `Vegas:       ${(m.vegasImplied * 100).toFixed(1)}%`,
    `Gap:         ${(m.spread * 100).toFixed(1)}%`,
    `Best book:   ${m.bestBook}`,
    ``,
    `Action: Buy ${m.direction} on Polymarket`,
    `Edge: +${(m.edge * 100).toFixed(1)}%`,
    ``,
    `_${m.question}_`,
    ``,
    `⚠️ Odds comparison only. Not a gambling service.`,
    `Must be 18+ to use sportsbooks. 1-800-522-4700`,
    ``,
    `EdgeHunter -- edgehunter.net`,
  ].join("\n");

  if (alertSettings.telegram.enabled && alertSettings.telegram.chatId && tgToken) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: alertSettings.telegram.chatId, text: tgText, parse_mode: "Markdown" }),
      });
      out.telegram = r.ok;
    } catch {}
  }

  if (alertSettings.discord.enabled && alertSettings.discord.webhookUrl) {
    const colorHex = parseInt(getConfidenceColor(m.confidence).replace("#", ""), 16);
    try {
      const r = await fetch(alertSettings.discord.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `${m.game.homeTeam} vs ${m.game.awayTeam}`,
            color: colorHex,
            fields: [
              { name: "League", value: m.league, inline: true },
              { name: "Direction", value: `Buy ${m.direction} on Polymarket`, inline: true },
              { name: "Polymarket", value: `${(m.polyImplied * 100).toFixed(1)}%`, inline: true },
              { name: "Vegas", value: `${(m.vegasImplied * 100).toFixed(1)}%`, inline: true },
              { name: "Gap", value: `${(m.spread * 100).toFixed(1)}%`, inline: true },
              { name: "Edge", value: `+${(m.edge * 100).toFixed(1)}%`, inline: true },
              { name: "Best book", value: m.bestBook, inline: false },
              { name: "Question", value: m.question, inline: false },
            ],
            footer: { text: "EdgeHunter — Odds data only. Not a gambling service. 18+ | 1-800-522-4700" },
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      out.discord = r.ok;
    } catch {}
  }

  return out;
}
