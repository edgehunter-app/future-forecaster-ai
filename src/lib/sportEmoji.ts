// Sport / league → emoji lookup for compact UI badges.
export function sportEmoji(input?: string | null): string {
  if (!input) return "🎯";
  const s = input.toLowerCase();
  if (s.includes("nfl") || s.includes("americanfootball") || s.includes("ncaaf") || s.includes("cfb")) return "🏈";
  if (s.includes("mlb") || s.includes("baseball")) return "⚾";
  if (s.includes("nba") || s.includes("wnba") || s.includes("basketball")) return "🏀";
  if (s.includes("nhl") || s.includes("hockey")) return "🏒";
  if (s.includes("golf") || s.includes("pga") || s.includes("liv")) return "⛳";
  if (s.includes("tennis") || s.includes("atp") || s.includes("wta")) return "🎾";
  if (s.includes("mma") || s.includes("ufc") || s.includes("boxing")) return "🥊";
  if (s.includes("soccer") || s.includes("fifa") || s.includes("epl") || s.includes("uefa") || s.includes("mls")) return "⚽";
  if (s.includes("horse") || s.includes("racing")) return "🐎";
  return "🎯";
}