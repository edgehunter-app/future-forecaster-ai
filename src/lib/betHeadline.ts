// Helpers for rendering the recommendation headline as
// "BET <Team> ML" / "BET <Team> -1.5" / "BET OVER 214.5".

const MULTI_WORD_NICKNAMES = [
  "Red Sox",
  "White Sox",
  "Blue Jays",
  "Trail Blazers",
  "Golden Knights",
  "Maple Leafs",
];

/** Returns the team nickname (last word, or known multi-word nickname). */
export function teamNickname(fullName: string): string {
  if (!fullName) return "";
  for (const nick of MULTI_WORD_NICKNAMES) {
    if (fullName.endsWith(nick)) return nick;
  }
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

function formatSpread(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

export interface HeadlineGame {
  homeTeam: string;
  awayTeam: string;
  spread?: { homeSpread?: number | null } | null;
  total?: { line?: number | null } | null;
}

export interface HeadlineAnalysisLike {
  recommendation: string;
  recommendedTeam?: string;
  betType?: string;
}

/** Resolves the side and corrects recommendedTeam to match. */
export function resolveSide(
  analysis: HeadlineAnalysisLike,
  game: HeadlineGame,
): { side: "HOME" | "AWAY" | "OVER" | "UNDER" | null; team: string } {
  // Normalize legacy formats like "AWAY — New York Yankees" or "AWAY - Yankees".
  const rawRec = (analysis.recommendation ?? "").toString().trim();
  const recParts = rawRec.split(/\s*[—–-]\s*/);
  const rec = (recParts[0] ?? "").toUpperCase();
  const inlineTeam = recParts.slice(1).join(" ").trim();
  const recTeamRaw = (analysis.recommendedTeam ?? inlineTeam ?? "").trim();

  if (rec === "HOME") {
    if (recTeamRaw.toLowerCase() !== game.homeTeam.toLowerCase()) {
      analysis.recommendedTeam = game.homeTeam;
    }
    return { side: "HOME", team: game.homeTeam };
  }
  if (rec === "AWAY") {
    if (recTeamRaw.toLowerCase() !== game.awayTeam.toLowerCase()) {
      analysis.recommendedTeam = game.awayTeam;
    }
    return { side: "AWAY", team: game.awayTeam };
  }
  if (rec === "OVER") return { side: "OVER", team: "" };
  if (rec === "UNDER") return { side: "UNDER", team: "" };

  // Unknown recommendation — try to infer side from named team.
  const matchesHome = !!recTeamRaw && game.homeTeam.toLowerCase().includes(recTeamRaw.toLowerCase());
  const matchesAway = !!recTeamRaw && game.awayTeam.toLowerCase().includes(recTeamRaw.toLowerCase());
  if (matchesHome) return { side: "HOME", team: game.homeTeam };
  if (matchesAway) return { side: "AWAY", team: game.awayTeam };
  return { side: null, team: recTeamRaw };
}

/** Builds the primary headline string, e.g. "BET Yankees ML". */
export function buildBetHeadline(
  analysis: HeadlineAnalysisLike,
  game: HeadlineGame,
): { headline: string; sideLabel: string } {
  const { side, team } = resolveSide(analysis, game);
  const betType = analysis.betType;

  if (side === "OVER" || side === "UNDER") {
    const line = game.total?.line;
    return {
      headline: `BET ${side}${line != null ? ` ${line}` : ""}`,
      sideLabel: "Total",
    };
  }

  if (side === "HOME" || side === "AWAY") {
    const nick = teamNickname(team);
    const sideLabel = side === "HOME" ? "Home team" : "Away team";
    if (betType === "spread") {
      const homeSpread = game.spread?.homeSpread;
      const teamSpread = side === "HOME" ? homeSpread : homeSpread != null ? -homeSpread : null;
      const spreadStr = formatSpread(teamSpread);
      return {
        headline: spreadStr ? `BET ${nick} ${spreadStr}` : `BET ${nick}`,
        sideLabel,
      };
    }
    // Default: moneyline
    return { headline: `BET ${nick} ML`, sideLabel };
  }

  // Fallback — unknown side
  return {
    headline: team ? `BET ${teamNickname(team)}` : `BET ${analysis.recommendation}`,
    sideLabel: "",
  };
}