// AUTO-GENERATED reference data (ESPN group/team metadata, 2026 season).
// Odds providers do not return conference, division, or poll rankings, so this
// static table supplies conference + FBS/FCS division for college football.

export type CfbDivision = "FBS" | "FCS";

export interface CfbTeamMeta {
  location: string;
  nickname: string;
  conference: string;
  division: CfbDivision;
}

const RAW: [string, string, string, CfbDivision][] = [
  ["Boston College", "Eagles", "ACC", "FBS"],
  ["California", "Golden Bears", "ACC", "FBS"],
  ["Clemson", "Tigers", "ACC", "FBS"],
  ["Duke", "Blue Devils", "ACC", "FBS"],
  ["Florida State", "Seminoles", "ACC", "FBS"],
  ["Georgia Tech", "Yellow Jackets", "ACC", "FBS"],
  ["Louisville", "Cardinals", "ACC", "FBS"],
  ["Miami", "Hurricanes", "ACC", "FBS"],
  ["NC State", "Wolfpack", "ACC", "FBS"],
  ["North Carolina", "Tar Heels", "ACC", "FBS"],
  ["Pittsburgh", "Panthers", "ACC", "FBS"],
  ["SMU", "Mustangs", "ACC", "FBS"],
  ["Stanford", "Cardinal", "ACC", "FBS"],
  ["Syracuse", "Orange", "ACC", "FBS"],
  ["Virginia", "Cavaliers", "ACC", "FBS"],
  ["Virginia Tech", "Hokies", "ACC", "FBS"],
  ["Wake Forest", "Demon Deacons", "ACC", "FBS"],
  ["Army", "Black Knights", "American", "FBS"],
  ["Charlotte", "49ers", "American", "FBS"],
  ["East Carolina", "Pirates", "American", "FBS"],
  ["Florida Atlantic", "Owls", "American", "FBS"],
  ["Memphis", "Tigers", "American", "FBS"],
  ["Navy", "Midshipmen", "American", "FBS"],
  ["North Texas", "Mean Green", "American", "FBS"],
  ["Rice", "Owls", "American", "FBS"],
  ["South Florida", "Bulls", "American", "FBS"],
  ["Temple", "Owls", "American", "FBS"],
  ["Tulane", "Green Wave", "American", "FBS"],
  ["Tulsa", "Golden Hurricane", "American", "FBS"],
  ["UAB", "Blazers", "American", "FBS"],
  ["UTSA", "Roadrunners", "American", "FBS"],
  ["Arizona", "Wildcats", "Big 12", "FBS"],
  ["Arizona State", "Sun Devils", "Big 12", "FBS"],
  ["BYU", "Cougars", "Big 12", "FBS"],
  ["Baylor", "Bears", "Big 12", "FBS"],
  ["Cincinnati", "Bearcats", "Big 12", "FBS"],
  ["Colorado", "Buffaloes", "Big 12", "FBS"],
  ["Houston", "Cougars", "Big 12", "FBS"],
  ["Iowa State", "Cyclones", "Big 12", "FBS"],
  ["Kansas", "Jayhawks", "Big 12", "FBS"],
  ["Kansas State", "Wildcats", "Big 12", "FBS"],
  ["Oklahoma State", "Cowboys", "Big 12", "FBS"],
  ["TCU", "Horned Frogs", "Big 12", "FBS"],
  ["Texas Tech", "Red Raiders", "Big 12", "FBS"],
  ["UCF", "Knights", "Big 12", "FBS"],
  ["Utah", "Utes", "Big 12", "FBS"],
  ["West Virginia", "Mountaineers", "Big 12", "FBS"],
  ["Illinois", "Fighting Illini", "Big Ten", "FBS"],
  ["Indiana", "Hoosiers", "Big Ten", "FBS"],
  ["Iowa", "Hawkeyes", "Big Ten", "FBS"],
  ["Maryland", "Terrapins", "Big Ten", "FBS"],
  ["Michigan", "Wolverines", "Big Ten", "FBS"],
  ["Michigan State", "Spartans", "Big Ten", "FBS"],
  ["Minnesota", "Golden Gophers", "Big Ten", "FBS"],
  ["Nebraska", "Cornhuskers", "Big Ten", "FBS"],
  ["Northwestern", "Wildcats", "Big Ten", "FBS"],
  ["Ohio State", "Buckeyes", "Big Ten", "FBS"],
  ["Oregon", "Ducks", "Big Ten", "FBS"],
  ["Penn State", "Nittany Lions", "Big Ten", "FBS"],
  ["Purdue", "Boilermakers", "Big Ten", "FBS"],
  ["Rutgers", "Scarlet Knights", "Big Ten", "FBS"],
  ["UCLA", "Bruins", "Big Ten", "FBS"],
  ["USC", "Trojans", "Big Ten", "FBS"],
  ["Washington", "Huskies", "Big Ten", "FBS"],
  ["Wisconsin", "Badgers", "Big Ten", "FBS"],
  ["Delaware", "Blue Hens", "CUSA", "FBS"],
  ["Florida International", "Panthers", "CUSA", "FBS"],
  ["Jacksonville State", "Gamecocks", "CUSA", "FBS"],
  ["Kennesaw State", "Owls", "CUSA", "FBS"],
  ["Liberty", "Flames", "CUSA", "FBS"],
  ["Middle Tennessee", "Blue Raiders", "CUSA", "FBS"],
  ["Missouri State", "Bears", "CUSA", "FBS"],
  ["New Mexico State", "Aggies", "CUSA", "FBS"],
  ["Sam Houston", "Bearkats", "CUSA", "FBS"],
  ["Western Kentucky", "Hilltoppers", "CUSA", "FBS"],
  ["Notre Dame", "Fighting Irish", "FBS Indep.", "FBS"],
  ["UConn", "Huskies", "FBS Indep.", "FBS"],
  ["Akron", "Zips", "MAC", "FBS"],
  ["Ball State", "Cardinals", "MAC", "FBS"],
  ["Bowling Green", "Falcons", "MAC", "FBS"],
  ["Buffalo", "Bulls", "MAC", "FBS"],
  ["Central Michigan", "Chippewas", "MAC", "FBS"],
  ["Eastern Michigan", "Eagles", "MAC", "FBS"],
  ["Kent State", "Golden Flashes", "MAC", "FBS"],
  ["Massachusetts", "Minutemen", "MAC", "FBS"],
  ["Miami (OH)", "RedHawks", "MAC", "FBS"],
  ["Ohio", "Bobcats", "MAC", "FBS"],
  ["Sacramento State", "Hornets", "MAC", "FBS"],
  ["Toledo", "Rockets", "MAC", "FBS"],
  ["Western Michigan", "Broncos", "MAC", "FBS"],
  ["Air Force", "Falcons", "Mountain West", "FBS"],
  ["Hawai'i", "Rainbow Warriors", "Mountain West", "FBS"],
  ["Nevada", "Wolf Pack", "Mountain West", "FBS"],
  ["New Mexico", "Lobos", "Mountain West", "FBS"],
  ["North Dakota State", "Bison", "Mountain West", "FBS"],
  ["Northern Illinois", "Huskies", "Mountain West", "FBS"],
  ["San José State", "Spartans", "Mountain West", "FBS"],
  ["UNLV", "Rebels", "Mountain West", "FBS"],
  ["UTEP", "Miners", "Mountain West", "FBS"],
  ["Wyoming", "Cowboys", "Mountain West", "FBS"],
  ["Boise State", "Broncos", "Pac-12", "FBS"],
  ["Colorado State", "Rams", "Pac-12", "FBS"],
  ["Fresno State", "Bulldogs", "Pac-12", "FBS"],
  ["Oregon State", "Beavers", "Pac-12", "FBS"],
  ["San Diego State", "Aztecs", "Pac-12", "FBS"],
  ["Texas State", "Bobcats", "Pac-12", "FBS"],
  ["Utah State", "Aggies", "Pac-12", "FBS"],
  ["Washington State", "Cougars", "Pac-12", "FBS"],
  ["Alabama", "Crimson Tide", "SEC", "FBS"],
  ["Arkansas", "Razorbacks", "SEC", "FBS"],
  ["Auburn", "Tigers", "SEC", "FBS"],
  ["Florida", "Gators", "SEC", "FBS"],
  ["Georgia", "Bulldogs", "SEC", "FBS"],
  ["Kentucky", "Wildcats", "SEC", "FBS"],
  ["LSU", "Tigers", "SEC", "FBS"],
  ["Mississippi State", "Bulldogs", "SEC", "FBS"],
  ["Missouri", "Tigers", "SEC", "FBS"],
  ["Oklahoma", "Sooners", "SEC", "FBS"],
  ["Ole Miss", "Rebels", "SEC", "FBS"],
  ["South Carolina", "Gamecocks", "SEC", "FBS"],
  ["Tennessee", "Volunteers", "SEC", "FBS"],
  ["Texas", "Longhorns", "SEC", "FBS"],
  ["Texas A&M", "Aggies", "SEC", "FBS"],
  ["Vanderbilt", "Commodores", "SEC", "FBS"],
  ["App State", "Mountaineers", "Sun Belt", "FBS"],
  ["Arkansas State", "Red Wolves", "Sun Belt", "FBS"],
  ["Coastal Carolina", "Chanticleers", "Sun Belt", "FBS"],
  ["Georgia Southern", "Eagles", "Sun Belt", "FBS"],
  ["Georgia State", "Panthers", "Sun Belt", "FBS"],
  ["James Madison", "Dukes", "Sun Belt", "FBS"],
  ["Louisiana", "Ragin' Cajuns", "Sun Belt", "FBS"],
  ["Louisiana Tech", "Bulldogs", "Sun Belt", "FBS"],
  ["Marshall", "Thundering Herd", "Sun Belt", "FBS"],
  ["Old Dominion", "Monarchs", "Sun Belt", "FBS"],
  ["South Alabama", "Jaguars", "Sun Belt", "FBS"],
  ["Southern Miss", "Golden Eagles", "Sun Belt", "FBS"],
  ["Troy", "Trojans", "Sun Belt", "FBS"],
  ["UL Monroe", "Warhawks", "Sun Belt", "FBS"],
  ["Cal Poly", "Mustangs", "Big Sky", "FCS"],
  ["Eastern Washington", "Eagles", "Big Sky", "FCS"],
  ["Idaho", "Vandals", "Big Sky", "FCS"],
  ["Idaho State", "Bengals", "Big Sky", "FCS"],
  ["Montana", "Grizzlies", "Big Sky", "FCS"],
  ["Montana State", "Bobcats", "Big Sky", "FCS"],
  ["Northern Arizona", "Lumberjacks", "Big Sky", "FCS"],
  ["Northern Colorado", "Bears", "Big Sky", "FCS"],
  ["Portland State", "Vikings", "Big Sky", "FCS"],
  ["Southern Utah", "Thunderbirds", "Big Sky", "FCS"],
  ["UC Davis", "Aggies", "Big Sky", "FCS"],
  ["Utah Tech", "Trailblazers", "Big Sky", "FCS"],
  ["Weber State", "Wildcats", "Big Sky", "FCS"],
  ["Bryant", "Bulldogs", "CAA", "FCS"],
  ["Campbell", "Fighting Camels", "CAA", "FCS"],
  ["Elon", "Phoenix", "CAA", "FCS"],
  ["Hampton", "Pirates", "CAA", "FCS"],
  ["Maine", "Black Bears", "CAA", "FCS"],
  ["Monmouth", "Hawks", "CAA", "FCS"],
  ["New Hampshire", "Wildcats", "CAA", "FCS"],
  ["North Carolina A&T", "Aggies", "CAA", "FCS"],
  ["Rhode Island", "Rams", "CAA", "FCS"],
  ["Sacred Heart", "Pioneers", "CAA", "FCS"],
  ["Stony Brook", "Seawolves", "CAA", "FCS"],
  ["Towson", "Tigers", "CAA", "FCS"],
  ["UAlbany", "Great Danes", "CAA", "FCS"],
  ["Chicago State", "Cougars", "FCS Indep.", "FCS"],
  ["Merrimack", "Warriors", "FCS Indep.", "FCS"],
  ["Brown", "Bears", "Ivy", "FCS"],
  ["Columbia", "Lions", "Ivy", "FCS"],
  ["Cornell", "Big Red", "Ivy", "FCS"],
  ["Dartmouth", "Big Green", "Ivy", "FCS"],
  ["Harvard", "Crimson", "Ivy", "FCS"],
  ["Pennsylvania", "Quakers", "Ivy", "FCS"],
  ["Princeton", "Tigers", "Ivy", "FCS"],
  ["Yale", "Bulldogs", "Ivy", "FCS"],
  ["Delaware State", "Hornets", "MEAC", "FCS"],
  ["Howard", "Bison", "MEAC", "FCS"],
  ["Morgan State", "Bears", "MEAC", "FCS"],
  ["Norfolk State", "Spartans", "MEAC", "FCS"],
  ["North Carolina Central", "Eagles", "MEAC", "FCS"],
  ["South Carolina State", "Bulldogs", "MEAC", "FCS"],
  ["Illinois State", "Redbirds", "MVFC", "FCS"],
  ["Indiana State", "Sycamores", "MVFC", "FCS"],
  ["Murray State", "Racers", "MVFC", "FCS"],
  ["North Dakota", "Fighting Hawks", "MVFC", "FCS"],
  ["Northern Iowa", "Panthers", "MVFC", "FCS"],
  ["South Dakota", "Coyotes", "MVFC", "FCS"],
  ["South Dakota State", "Jackrabbits", "MVFC", "FCS"],
  ["Southern Illinois", "Salukis", "MVFC", "FCS"],
  ["Youngstown State", "Penguins", "MVFC", "FCS"],
  ["Central Connecticut", "Blue Devils", "NEC", "FCS"],
  ["Duquesne", "Dukes", "NEC", "FCS"],
  ["Long Island University", "Sharks", "NEC", "FCS"],
  ["Mercyhurst", "Lakers", "NEC", "FCS"],
  ["New Haven", "Chargers", "NEC", "FCS"],
  ["Robert Morris", "Colonials", "NEC", "FCS"],
  ["Stonehill", "Skyhawks", "NEC", "FCS"],
  ["Wagner", "Seahawks", "NEC", "FCS"],
  ["Charleston Southern", "Buccaneers", "OVC", "FCS"],
  ["Eastern Illinois", "Panthers", "OVC", "FCS"],
  ["Gardner-Webb", "Runnin' Bulldogs", "OVC", "FCS"],
  ["Lindenwood", "Lions", "OVC", "FCS"],
  ["Southeast Missouri State", "Redhawks", "OVC", "FCS"],
  ["Tennessee State", "Tigers", "OVC", "FCS"],
  ["UT Martin", "Skyhawks", "OVC", "FCS"],
  ["Western Illinois", "Leathernecks", "OVC", "FCS"],
  ["Bucknell", "Bison", "Patriot", "FCS"],
  ["Colgate", "Raiders", "Patriot", "FCS"],
  ["Fordham", "Rams", "Patriot", "FCS"],
  ["Georgetown", "Hoyas", "Patriot", "FCS"],
  ["Holy Cross", "Crusaders", "Patriot", "FCS"],
  ["Lafayette", "Leopards", "Patriot", "FCS"],
  ["Lehigh", "Mountain Hawks", "Patriot", "FCS"],
  ["Richmond", "Spiders", "Patriot", "FCS"],
  ["Villanova", "Wildcats", "Patriot", "FCS"],
  ["William & Mary", "Tribe", "Patriot", "FCS"],
  ["Butler", "Bulldogs", "Pioneer", "FCS"],
  ["Davidson", "Wildcats", "Pioneer", "FCS"],
  ["Dayton", "Flyers", "Pioneer", "FCS"],
  ["Drake", "Bulldogs", "Pioneer", "FCS"],
  ["Marist", "Red Foxes", "Pioneer", "FCS"],
  ["Morehead State", "Eagles", "Pioneer", "FCS"],
  ["Presbyterian", "Blue Hose", "Pioneer", "FCS"],
  ["San Diego", "Toreros", "Pioneer", "FCS"],
  ["St. Thomas", "Tommies", "Pioneer", "FCS"],
  ["Stetson", "Hatters", "Pioneer", "FCS"],
  ["Valparaiso", "Beacons", "Pioneer", "FCS"],
  ["Alabama A&M", "Bulldogs", "SWAC", "FCS"],
  ["Alabama State", "Hornets", "SWAC", "FCS"],
  ["Alcorn State", "Braves", "SWAC", "FCS"],
  ["Arkansas-Pine Bluff", "Golden Lions", "SWAC", "FCS"],
  ["Bethune-Cookman", "Wildcats", "SWAC", "FCS"],
  ["Florida A&M", "Rattlers", "SWAC", "FCS"],
  ["Grambling", "Tigers", "SWAC", "FCS"],
  ["Jackson State", "Tigers", "SWAC", "FCS"],
  ["Mississippi Valley State", "Delta Devils", "SWAC", "FCS"],
  ["Prairie View A&M", "Panthers", "SWAC", "FCS"],
  ["Southern", "Jaguars", "SWAC", "FCS"],
  ["Texas Southern", "Tigers", "SWAC", "FCS"],
  ["Chattanooga", "Mocs", "Southern", "FCS"],
  ["East Tennessee State", "Buccaneers", "Southern", "FCS"],
  ["Furman", "Paladins", "Southern", "FCS"],
  ["Mercer", "Bears", "Southern", "FCS"],
  ["Samford", "Bulldogs", "Southern", "FCS"],
  ["Tennessee Tech", "Golden Eagles", "Southern", "FCS"],
  ["The Citadel", "Bulldogs", "Southern", "FCS"],
  ["VMI", "Keydets", "Southern", "FCS"],
  ["Western Carolina", "Catamounts", "Southern", "FCS"],
  ["Wofford", "Terriers", "Southern", "FCS"],
  ["East Texas A&M", "Lions", "Southland", "FCS"],
  ["Houston Christian", "Huskies", "Southland", "FCS"],
  ["Incarnate Word", "Cardinals", "Southland", "FCS"],
  ["Lamar", "Cardinals", "Southland", "FCS"],
  ["McNeese", "Cowboys", "Southland", "FCS"],
  ["Nicholls", "Colonels", "Southland", "FCS"],
  ["Northwestern State", "Demons", "Southland", "FCS"],
  ["SE Louisiana", "Lions", "Southland", "FCS"],
  ["Stephen F. Austin", "Lumberjacks", "Southland", "FCS"],
  ["UT Rio Grande Valley", "Vaqueros", "Southland", "FCS"],
  ["Abilene Christian", "Wildcats", "UAC", "FCS"],
  ["Austin Peay", "Governors", "UAC", "FCS"],
  ["Central Arkansas", "Bears", "UAC", "FCS"],
  ["Eastern Kentucky", "Colonels", "UAC", "FCS"],
  ["North Alabama", "Lions", "UAC", "FCS"],
  ["Tarleton State", "Texans", "UAC", "FCS"],
  ["West Florida", "Argonauts", "UAC", "FCS"],
  ["West Georgia", "Wolves", "UAC", "FCS"],
];

export const CFB_CONFERENCES_FBS = [
  "SEC",
  "Big Ten",
  "ACC",
  "Big 12",
  "Pac-12",
  "American",
  "Mountain West",
  "Sun Belt",
  "MAC",
  "CUSA",
  "FBS Indep.",
];

const norm = (s: string) =>
  s
    .toLowerCase()
    // Strip diacritics: "José" -> "jose" (provider sends "San Jose State").
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    // Drop apostrophes without leaving a word break: "Hawai'i" -> "hawaii",
    // so it matches the provider's "Hawaii".
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BY_KEY = new Map<string, CfbTeamMeta>();

for (const [location, nickname, conference, division] of RAW) {
  const meta: CfbTeamMeta = { location, nickname, conference, division };
  BY_KEY.set(norm(location), meta);
  BY_KEY.set(norm(`${location} ${nickname}`), meta);
}

/** Look up conference/division for a team name in any provider spelling. */
export function cfbTeamMeta(teamName: string | undefined | null): CfbTeamMeta | null {
  if (!teamName) return null;
  const key = norm(teamName);
  if (BY_KEY.has(key)) return BY_KEY.get(key)!;
  // Provider may append or omit the mascot: match the longest known prefix, but
  // only when the leftover words are actually that school's mascot. Without the
  // check, "Houston Baptist Huskies" (FCS) would wrongly resolve to "Houston".
  let best: CfbTeamMeta | null = null;
  let bestLen = 0;
  for (const [k, meta] of BY_KEY) {
    if (k.length <= bestLen) continue;
    if (!(key === k || key.startsWith(`${k} `))) continue;
    const remainder = key.slice(k.length).trim();
    if (remainder) {
      const mascot = norm(meta.nickname).split(" ").filter(Boolean);
      const extra = remainder.split(" ").filter(Boolean);
      if (!extra.every((w) => mascot.includes(w))) continue;
    }
    best = meta;
    bestLen = k.length;
  }
  return best;

}

export function cfbConference(teamName: string): string | null {
  return cfbTeamMeta(teamName)?.conference ?? null;
}

export function cfbDivision(teamName: string): CfbDivision | null {
  return cfbTeamMeta(teamName)?.division ?? null;
}
