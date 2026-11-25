// src/core/theme.ts
var DEFAULT_PALETTE = [
  "#2563eb",
  // blue-600
  "#059669",
  // emerald-600
  "#d97706",
  // amber-600
  "#7c3aed",
  // violet-600
  "#dc2626",
  // red-600
  "#0891b2",
  // cyan-600
  "#db2777",
  // pink-600
  "#475569"
  // slate-600
];
var MONOCHROME_PALETTE = [
  "#1f2937",
  "#374151",
  "#4b5563",
  "#6b7280",
  "#9ca3af",
  "#7a7a7a",
  "#525252",
  "#262626"
];
var DARK_PALETTE = [
  "#6d8fff",
  // blue
  "#34d399",
  // green
  "#fbbf24",
  // peach
  "#a78bfa",
  // mauve
  "#f87171",
  // red
  "#22d3ee",
  // teal
  "#f472b6",
  // pink
  "#38bdf8"
  // sky
];
var DEFAULT_THEME = {
  bg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  stroke: "#334155",
  fill: "#ffffff",
  fillMuted: "#f1f5f9",
  accent: "#2563eb",
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#94a3b8",
  warn: "#d97706",
  palette: DEFAULT_PALETTE
};
var MONOCHROME_THEME = {
  bg: "#ffffff",
  text: "#000000",
  textMuted: "#555555",
  stroke: "#000000",
  fill: "#ffffff",
  fillMuted: "#f0f0f0",
  accent: "#000000",
  positive: "#000000",
  negative: "#000000",
  neutral: "#888888",
  warn: "#000000",
  palette: MONOCHROME_PALETTE
};
var DARK_THEME = {
  bg: "#0f172a",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  stroke: "#f8fafc",
  fill: "#172033",
  fillMuted: "#202b3d",
  accent: "#6d8fff",
  positive: "#34d399",
  negative: "#f87171",
  neutral: "#64748b",
  warn: "#fbbf24",
  palette: DARK_PALETTE
};
var BASE_THEMES = {
  default: DEFAULT_THEME,
  monochrome: MONOCHROME_THEME,
  dark: DARK_THEME
};
var DEFAULT_PERSON = {
  maleFill: "#dbeafe",
  femaleFill: "#fce7f3",
  unknownFill: "#f5f5f5",
  deceasedMark: "#b71c1c",
  conditionFill: "#1565c0"
};
var MONOCHROME_PERSON = {
  maleFill: "#ffffff",
  femaleFill: "#ffffff",
  unknownFill: "#ffffff",
  deceasedMark: "#000000",
  conditionFill: "#000000"
};
var DARK_PERSON = {
  maleFill: "#1e3a5f",
  femaleFill: "#3e1f3e",
  unknownFill: "#202b3d",
  deceasedMark: "#f87171",
  conditionFill: "#6d8fff"
};
var PERSON_TOKENS = {
  default: DEFAULT_PERSON,
  monochrome: MONOCHROME_PERSON,
  dark: DARK_PERSON
};
var DEFAULT_BIOLOGY = {
  cladeColors: DEFAULT_PALETTE,
  supportGood: "#059669",
  supportMedium: "#ca8a04",
  supportWarn: "#d97706",
  supportBad: "#dc2626"
};
var MONOCHROME_BIOLOGY = {
  cladeColors: MONOCHROME_PALETTE,
  supportGood: "#000000",
  supportMedium: "#555555",
  supportWarn: "#888888",
  supportBad: "#aaaaaa"
};
var DARK_BIOLOGY = {
  cladeColors: DARK_PALETTE,
  supportGood: "#34d399",
  supportMedium: "#facc15",
  supportWarn: "#fbbf24",
  supportBad: "#f87171"
};
var BIOLOGY_TOKENS = {
  default: DEFAULT_BIOLOGY,
  monochrome: MONOCHROME_BIOLOGY,
  dark: DARK_BIOLOGY
};
var DEFAULT_VENN = {
  vennSetColors: DEFAULT_PALETTE,
  vennBlendMode: "multiply",
  vennSetOpacity: 0.38,
  vennSetStroke: "#94a3b8",
  vennLabelColor: "#0f172a",
  vennCountColor: "#0f172a",
  vennLeaderColor: "#64748b"
};
var MONOCHROME_VENN = {
  vennSetColors: ["#999999", "#999999", "#999999", "#999999", "#999999", "#999999", "#999999", "#999999"],
  vennBlendMode: "none",
  vennSetOpacity: 0.22,
  vennSetStroke: "#000000",
  vennLabelColor: "#000000",
  vennCountColor: "#000000",
  vennLeaderColor: "#444444"
};
var DARK_VENN = {
  vennSetColors: DARK_PALETTE,
  vennBlendMode: "screen",
  vennSetOpacity: 0.55,
  vennSetStroke: "#475569",
  vennLabelColor: "#f8fafc",
  vennCountColor: "#facc15",
  vennLeaderColor: "#94a3b8"
};
var VENN_TOKENS = {
  default: DEFAULT_VENN,
  monochrome: MONOCHROME_VENN,
  dark: DARK_VENN
};
var DEFAULT_MINDMAP = {
  centralFill: "#0f172a",
  branchPalette: DEFAULT_PALETTE,
  codeFg: "#be185d",
  codeBg: "#fdf2f8",
  linkColor: "#2563eb",
  checkboxStroke: "#64748b",
  checkboxFill: "#10b981"
};
var MONOCHROME_MINDMAP = {
  centralFill: "#000000",
  branchPalette: ["#000000"],
  codeFg: "#000000",
  codeBg: "#e5e5e5",
  linkColor: "#000000",
  checkboxStroke: "#000000",
  checkboxFill: "#000000"
};
var DARK_MINDMAP = {
  centralFill: "#f8fafc",
  branchPalette: DARK_PALETTE,
  codeFg: "#f472b6",
  codeBg: "#172033",
  linkColor: "#6d8fff",
  checkboxStroke: "#cbd5e1",
  checkboxFill: "#34d399"
};
var MINDMAP_TOKENS = {
  default: DEFAULT_MINDMAP,
  monochrome: MONOCHROME_MINDMAP,
  dark: DARK_MINDMAP
};
var DEFAULT_INDUSTRIAL = {
  bg: "#ffffff",
  stroke: "#222222",
  strokeHeavy: "#111111",
  text: "#111111",
  textMuted: "#555555",
  accent: "#1d4e89",
  error: "#cc0000"
};
var MONOCHROME_INDUSTRIAL = {
  bg: "#ffffff",
  stroke: "#000000",
  strokeHeavy: "#000000",
  text: "#000000",
  textMuted: "#333333",
  accent: "#000000",
  error: "#000000"
};
var DARK_INDUSTRIAL = {
  bg: "#0f172a",
  stroke: "#f8fafc",
  strokeHeavy: "#ffffff",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  accent: "#6d8fff",
  error: "#f87171"
};
var INDUSTRIAL_TOKENS = {
  default: DEFAULT_INDUSTRIAL,
  monochrome: MONOCHROME_INDUSTRIAL,
  dark: DARK_INDUSTRIAL
};
function resolveIndustrialTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...INDUSTRIAL_TOKENS[themeName] };
}
var DEFAULT_FLOWCHART = {
  stadiumFill: "#dbeafe",
  diamondFill: "#fef3c7",
  roundFill: "#dcfce7",
  classes: {
    start: { fill: "#f0ece0", stroke: "#9a8b6a", text: "#5c4e2e" },
    process: { fill: "#e8e4ff", stroke: "#8b7dd8", text: "#4c3a8f" },
    decision: { fill: "#fde8c8", stroke: "#d4985c", text: "#8a5a1f" },
    success: { fill: "#d4f0e0", stroke: "#7bc19a", text: "#1e5a3a" },
    danger: { fill: "#fbe0dc", stroke: "#d89181", text: "#8a3525" },
    neutral: { fill: "#ececec", stroke: "#a0a0a0", text: "#555555" }
  }
};
var MONOCHROME_FLOWCHART = {
  stadiumFill: "#ffffff",
  diamondFill: "#ffffff",
  roundFill: "#ffffff",
  classes: {
    start: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
    process: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
    decision: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
    success: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
    danger: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
    neutral: { fill: "#ffffff", stroke: "#000000", text: "#000000" }
  }
};
var DARK_FLOWCHART = {
  stadiumFill: "#1e3a5f",
  diamondFill: "#3a3a2a",
  roundFill: "#1f3a2a",
  classes: {
    start: { fill: "#3a3326", stroke: "#c9b88a", text: "#f5e7c7" },
    process: { fill: "#2e2a52", stroke: "#a89ee0", text: "#d9d2ff" },
    decision: { fill: "#3a2d1a", stroke: "#d4985c", text: "#f2d5a8" },
    success: { fill: "#1e3a2a", stroke: "#7bc19a", text: "#cdefd8" },
    danger: { fill: "#3a231f", stroke: "#d89181", text: "#f2d0c8" },
    neutral: { fill: "#172033", stroke: "#94a3b8", text: "#f8fafc" }
  }
};
var FLOWCHART_TOKENS = {
  default: DEFAULT_FLOWCHART,
  monochrome: MONOCHROME_FLOWCHART,
  dark: DARK_FLOWCHART
};
function resolveFlowchartTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...FLOWCHART_TOKENS[themeName] };
}
function resolveMindmapTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...MINDMAP_TOKENS[themeName] };
}
var DEFAULT_TIMELINE = {
  axis: "#334155",
  axisLabel: "#475569",
  eraLabel: "#0f172a",
  eraOpacity: 0.55,
  eraPlotOpacity: 0.14,
  laneStripe: "#f1f5f9",
  laneStripeOpacity: 0.6,
  categoryPalette: DEFAULT_PALETTE,
  markerRing: "#2563eb",
  markerFill: "#ffffff",
  milestoneFill: "#d97706",
  pinShaft: "#94a3b8",
  cardBg: "#ffffff",
  cardStroke: "#cbd5e1",
  cardText: "#0f172a",
  cardShadow: "rgba(15,23,42,0.08)",
  legendBg: "#f8fafc",
  legendStroke: "#e2e8f0"
};
var MONOCHROME_TIMELINE = {
  axis: "#000000",
  axisLabel: "#333333",
  eraLabel: "#000000",
  eraOpacity: 0.2,
  eraPlotOpacity: 0.08,
  laneStripe: "#f0f0f0",
  laneStripeOpacity: 0.6,
  categoryPalette: MONOCHROME_PALETTE,
  markerRing: "#000000",
  markerFill: "#ffffff",
  milestoneFill: "#000000",
  pinShaft: "#888888",
  cardBg: "#ffffff",
  cardStroke: "#000000",
  cardText: "#000000",
  cardShadow: "rgba(0,0,0,0.06)",
  legendBg: "#ffffff",
  legendStroke: "#000000"
};
var DARK_TIMELINE = {
  axis: "#f8fafc",
  axisLabel: "#94a3b8",
  eraLabel: "#f8fafc",
  eraOpacity: 0.5,
  eraPlotOpacity: 0.18,
  laneStripe: "#172033",
  laneStripeOpacity: 0.5,
  categoryPalette: DARK_PALETTE,
  markerRing: "#6d8fff",
  markerFill: "#0f172a",
  milestoneFill: "#fbbf24",
  pinShaft: "#64748b",
  cardBg: "#172033",
  cardStroke: "#202b3d",
  cardText: "#f8fafc",
  cardShadow: "rgba(0,0,0,0.35)",
  legendBg: "#0b1220",
  legendStroke: "#202b3d"
};
var TIMELINE_TOKENS = {
  default: DEFAULT_TIMELINE,
  monochrome: MONOCHROME_TIMELINE,
  dark: DARK_TIMELINE
};
function resolveTimelineTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...TIMELINE_TOKENS[themeName] };
}
var DEFAULT_PETRI = {
  placeFill: "#ffffff",
  placeStroke: "#334155",
  transitionBarFill: "#334155",
  transitionBoxFill: "#ffffff",
  transitionStroke: "#334155",
  tokenFill: "#0f172a",
  enabledStroke: "#059669",
  enabledFill: "#ecfdf5",
  deadStroke: "#94a3b8",
  inhibitorStroke: "#dc2626",
  arcStroke: "#334155",
  weightLabel: "#2563eb",
  tokenPalette: DEFAULT_PALETTE
};
var MONOCHROME_PETRI = {
  placeFill: "#ffffff",
  placeStroke: "#000000",
  transitionBarFill: "#000000",
  transitionBoxFill: "#ffffff",
  transitionStroke: "#000000",
  tokenFill: "#000000",
  enabledStroke: "#000000",
  enabledFill: "none",
  deadStroke: "#888888",
  inhibitorStroke: "#000000",
  arcStroke: "#000000",
  weightLabel: "#000000",
  tokenPalette: MONOCHROME_PALETTE
};
var DARK_PETRI = {
  placeFill: "#172033",
  placeStroke: "#f8fafc",
  transitionBarFill: "#f8fafc",
  transitionBoxFill: "#172033",
  transitionStroke: "#f8fafc",
  tokenFill: "#f8fafc",
  enabledStroke: "#34d399",
  enabledFill: "rgba(52,211,153,0.15)",
  deadStroke: "#64748b",
  inhibitorStroke: "#f87171",
  arcStroke: "#f8fafc",
  weightLabel: "#6d8fff",
  tokenPalette: DARK_PALETTE
};
var PETRI_TOKENS = {
  default: DEFAULT_PETRI,
  monochrome: MONOCHROME_PETRI,
  dark: DARK_PETRI
};
function resolvePetriTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...PETRI_TOKENS[themeName] };
}
var DEFAULT_RELIABILITY = {
  eventFill: "#eef2f7",
  // soft slate-blue — gives event boxes presence (cool tones pair with the red cut-set accent)
  eventStroke: "#334155",
  topEventStroke: "#1e293b",
  basicFill: "#ffffff",
  // white circles read clean inside a red cut-set frame
  basicStroke: "#334155",
  undevelopedFill: "#e2e8f0",
  houseFill: "#fef9c3",
  conditionFill: "#f1f5f9",
  gateFill: "#dcfce7",
  // green gates ("logic proceeds")
  gateStroke: "#059669",
  edgeStroke: "#475569",
  probText: "#2563eb",
  cutsetStroke: "#dc2626",
  cutsetFill: "rgba(220,38,38,0.05)",
  spofStroke: "#b91c1c"
};
var MONOCHROME_RELIABILITY = {
  eventFill: "#ffffff",
  eventStroke: "#000000",
  topEventStroke: "#000000",
  basicFill: "#ffffff",
  basicStroke: "#000000",
  undevelopedFill: "#ffffff",
  houseFill: "#ffffff",
  conditionFill: "#ffffff",
  gateFill: "#ffffff",
  gateStroke: "#000000",
  edgeStroke: "#000000",
  probText: "#000000",
  cutsetStroke: "#000000",
  cutsetFill: "none",
  spofStroke: "#000000"
};
var DARK_RELIABILITY = {
  eventFill: "#172033",
  eventStroke: "#f8fafc",
  topEventStroke: "#f8fafc",
  basicFill: "#172033",
  basicStroke: "#f8fafc",
  undevelopedFill: "#202b3d",
  houseFill: "#45413a",
  conditionFill: "#202b3d",
  gateFill: "rgba(52,211,153,0.18)",
  gateStroke: "#34d399",
  edgeStroke: "#f8fafc",
  probText: "#6d8fff",
  cutsetStroke: "#f87171",
  cutsetFill: "rgba(248,113,113,0.12)",
  spofStroke: "#fb7185"
};
var RELIABILITY_TOKENS = {
  default: DEFAULT_RELIABILITY,
  monochrome: MONOCHROME_RELIABILITY,
  dark: DARK_RELIABILITY
};
function resolveReliabilityTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...RELIABILITY_TOKENS[themeName] };
}
var DEFAULT_BOWTIE = {
  hazardFill: "#fef9c3",
  // pale yellow hazard header (conventional)
  hazardStroke: "#ca8a04",
  topEventFill: "#dcfce7",
  // green disc knot (bowtiemaster)
  topEventStroke: "#16a34a",
  threatFill: "#fed7aa",
  // orange threats (de-facto)
  threatStroke: "#ea580c",
  barrierFill: "#e5e7eb",
  // grey barriers (de-facto)
  barrierStroke: "#6b7280",
  consequenceFill: "#fecaca",
  // red consequences (de-facto)
  consequenceStroke: "#dc2626",
  escalationFill: "#fde68a",
  // amber escalation factors (de-facto)
  escalationStroke: "#d97706",
  efBarrierFill: "#e5e7eb",
  lineStroke: "#334155",
  escalationLineStroke: "#9ca3af",
  labelText: "#0f172a"
};
var MONOCHROME_BOWTIE = {
  hazardFill: "#ffffff",
  hazardStroke: "#000000",
  topEventFill: "#ffffff",
  topEventStroke: "#000000",
  threatFill: "#ffffff",
  threatStroke: "#000000",
  barrierFill: "#f2f2f2",
  barrierStroke: "#000000",
  consequenceFill: "#ffffff",
  consequenceStroke: "#000000",
  escalationFill: "#ffffff",
  escalationStroke: "#000000",
  efBarrierFill: "#f2f2f2",
  lineStroke: "#000000",
  escalationLineStroke: "#000000",
  labelText: "#000000"
};
var DARK_BOWTIE = {
  hazardFill: "#45413a",
  hazardStroke: "#facc15",
  topEventFill: "#34d399",
  topEventStroke: "#40a02b",
  threatFill: "#fbbf24",
  threatStroke: "#e8a06a",
  barrierFill: "#94a3b8",
  // light-grey surface so the single dark label reads
  barrierStroke: "#64748b",
  consequenceFill: "#f87171",
  consequenceStroke: "#e06c85",
  escalationFill: "#facc15",
  escalationStroke: "#d8bd84",
  efBarrierFill: "#94a3b8",
  lineStroke: "#f8fafc",
  escalationLineStroke: "#94a3b8",
  labelText: "#0f172a"
};
var BOWTIE_TOKENS = {
  default: DEFAULT_BOWTIE,
  monochrome: MONOCHROME_BOWTIE,
  dark: DARK_BOWTIE
};
function resolveBowtieTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...BOWTIE_TOKENS[themeName] };
}
var DEFAULT_COMPARISON = {
  headerFill: "#1e3a8a",
  headerStroke: "#1e3a8a",
  headerText: "#ffffff",
  rowHeaderFill: "#eef2ff",
  cellFill: "#ffffff",
  cellAltFill: "#f8fafc",
  cellStroke: "#cbd5e1",
  cellText: "#0f172a",
  gridStroke: "#cbd5e1",
  columnColors: ["#1d4ed8", "#0e7490", "#7c3aed", "#c2410c", "#15803d", "#be185d"],
  columnText: "#ffffff",
  cardFill: "#ffffff",
  cardStroke: "#e2e8f0",
  rowDivider: "#eef2f6",
  posFill: "#dcfce7",
  posText: "#15803d",
  negFill: "#fee2e2",
  negText: "#b91c1c",
  warnFill: "#fef9c3",
  warnText: "#a16207",
  winnerFill: "#bbf7d0",
  winnerStroke: "#16a34a",
  winnerText: "#14532d",
  totalFill: "#e2e8f0",
  baselineFill: "#dbeafe",
  tagText: "#64748b",
  captionText: "#334155",
  pillPosFill: "#16a34a",
  pillNegFill: "#e11d48",
  pillText: "#ffffff",
  badgeText: "#ffffff",
  dbLeftCenterFill: "#1d4ed8",
  dbLeftCenterText: "#ffffff",
  dbRightCenterFill: "#0e7490",
  dbRightCenterText: "#ffffff",
  dbSharedFill: "#65a30d",
  dbSharedText: "#ffffff",
  dbLeftFill: "#dbeafe",
  dbLeftText: "#1e3a8a",
  dbRightFill: "#cffafe",
  dbRightText: "#155e75",
  dbStroke: "#ffffff",
  connectorStroke: "#94a3b8"
};
var MONOCHROME_COMPARISON = {
  headerFill: "#000000",
  headerStroke: "#000000",
  headerText: "#ffffff",
  rowHeaderFill: "#f0f0f0",
  cellFill: "#ffffff",
  cellAltFill: "#f7f7f7",
  cellStroke: "#000000",
  cellText: "#000000",
  gridStroke: "#000000",
  columnColors: ["#000000"],
  columnText: "#ffffff",
  cardFill: "#ffffff",
  cardStroke: "#000000",
  rowDivider: "#cccccc",
  posFill: "#ffffff",
  posText: "#000000",
  negFill: "#ffffff",
  negText: "#000000",
  warnFill: "#ffffff",
  warnText: "#000000",
  winnerFill: "#e8e8e8",
  winnerStroke: "#000000",
  winnerText: "#000000",
  totalFill: "#e8e8e8",
  baselineFill: "#f0f0f0",
  tagText: "#555555",
  captionText: "#000000",
  pillPosFill: "#000000",
  pillNegFill: "#000000",
  pillText: "#ffffff",
  badgeText: "#ffffff",
  dbLeftCenterFill: "#000000",
  dbLeftCenterText: "#ffffff",
  dbRightCenterFill: "#000000",
  dbRightCenterText: "#ffffff",
  dbSharedFill: "#d9d9d9",
  dbSharedText: "#000000",
  dbLeftFill: "#ffffff",
  dbLeftText: "#000000",
  dbRightFill: "#ffffff",
  dbRightText: "#000000",
  dbStroke: "#000000",
  connectorStroke: "#000000"
};
var DARK_COMPARISON = {
  headerFill: "#6d8fff",
  headerStroke: "#6d8fff",
  headerText: "#0f172a",
  rowHeaderFill: "#172033",
  cellFill: "#0f172a",
  cellAltFill: "#252537",
  cellStroke: "#202b3d",
  cellText: "#f8fafc",
  gridStroke: "#202b3d",
  columnColors: ["#6d8fff", "#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f472b6"],
  columnText: "#0f172a",
  cardFill: "#0b1220",
  cardStroke: "#172033",
  rowDivider: "#172033",
  posFill: "#2d4a36",
  posText: "#34d399",
  negFill: "#4a2d33",
  negText: "#f87171",
  warnFill: "#4a452d",
  warnText: "#facc15",
  winnerFill: "#3a5a44",
  winnerStroke: "#34d399",
  winnerText: "#34d399",
  totalFill: "#172033",
  baselineFill: "#2a3a55",
  tagText: "#94a3b8",
  captionText: "#e2e8f0",
  pillPosFill: "#40a02b",
  pillNegFill: "#e06c85",
  pillText: "#ffffff",
  badgeText: "#0f172a",
  dbLeftCenterFill: "#6d8fff",
  dbLeftCenterText: "#0f172a",
  dbRightCenterFill: "#22d3ee",
  dbRightCenterText: "#0f172a",
  dbSharedFill: "#34d399",
  dbSharedText: "#0f172a",
  dbLeftFill: "#172033",
  dbLeftText: "#f8fafc",
  dbRightFill: "#3a3a4f",
  dbRightText: "#f8fafc",
  dbStroke: "#202b3d",
  connectorStroke: "#64748b"
};
var COMPARISON_TOKENS = {
  default: DEFAULT_COMPARISON,
  monochrome: MONOCHROME_COMPARISON,
  dark: DARK_COMPARISON
};
function resolveComparisonTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...COMPARISON_TOKENS[themeName] };
}
var DEFAULT_NETWORK = {
  deviceFill: "#1d6fb8",
  deviceStroke: "#0f3a5f",
  deviceAccent: "#bfe0f7",
  cloudFill: "#ffffff",
  cloudStroke: "#334155",
  label: "#0f172a",
  subLabel: "#64748b",
  linkCopper: "#334155",
  linkFiber: "#ea7a17",
  linkWireless: "#2563eb",
  linkSerial: "#7c3aed",
  linkPoe: "#059669",
  linkVpn: "#0891b2",
  linkLag: "#334155",
  linkLabel: "#475569",
  siteStroke: "#334155",
  subnetStroke: "#2563eb",
  subnetFill: "#eff6ff",
  zoneStroke: "#dc2626",
  vlanPalette: DEFAULT_PALETTE,
  warn: "#d97706"
};
var MONOCHROME_NETWORK = {
  deviceFill: "#ffffff",
  deviceStroke: "#000000",
  deviceAccent: "#000000",
  cloudFill: "#ffffff",
  cloudStroke: "#000000",
  label: "#000000",
  subLabel: "#444444",
  linkCopper: "#000000",
  linkFiber: "#000000",
  linkWireless: "#000000",
  linkSerial: "#000000",
  linkPoe: "#000000",
  linkVpn: "#000000",
  linkLag: "#000000",
  linkLabel: "#222222",
  siteStroke: "#000000",
  subnetStroke: "#000000",
  subnetFill: "none",
  zoneStroke: "#000000",
  vlanPalette: MONOCHROME_PALETTE,
  warn: "#000000"
};
var DARK_NETWORK = {
  deviceFill: "#6d8fff",
  deviceStroke: "#0f172a",
  deviceAccent: "#0f172a",
  cloudFill: "#172033",
  cloudStroke: "#f8fafc",
  label: "#f8fafc",
  subLabel: "#cbd5e1",
  linkCopper: "#f8fafc",
  linkFiber: "#fbbf24",
  linkWireless: "#6d8fff",
  linkSerial: "#a78bfa",
  linkPoe: "#34d399",
  linkVpn: "#22d3ee",
  linkLag: "#f8fafc",
  linkLabel: "#cbd5e1",
  siteStroke: "#f8fafc",
  subnetStroke: "#6d8fff",
  subnetFill: "rgba(109,143,255,0.12)",
  zoneStroke: "#f87171",
  vlanPalette: DARK_PALETTE,
  warn: "#fbbf24"
};
var NETWORK_TOKENS = {
  default: DEFAULT_NETWORK,
  monochrome: MONOCHROME_NETWORK,
  dark: DARK_NETWORK
};
function resolveNetworkTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...NETWORK_TOKENS[themeName] };
}
var DEFAULT_UMLCLASS = {
  classifierFill: "#ffffff",
  classifierStroke: "#334155",
  headerFill: "#eef2f7",
  nameText: "#0f172a",
  stereotypeText: "#64748b",
  memberText: "#0f172a",
  visibilityText: "#64748b",
  relationStroke: "#334155",
  adornmentFill: "#334155",
  adornmentHollowFill: "#ffffff",
  edgeLabel: "#475569",
  abstractAccent: "#2563eb",
  packageFill: "rgba(100,116,139,0.06)",
  packageStroke: "#94a3b8",
  packageLabel: "#475569"
};
var MONOCHROME_UMLCLASS = {
  classifierFill: "#ffffff",
  classifierStroke: "#000000",
  headerFill: "#ffffff",
  nameText: "#000000",
  stereotypeText: "#000000",
  memberText: "#000000",
  visibilityText: "#000000",
  relationStroke: "#000000",
  adornmentFill: "#000000",
  adornmentHollowFill: "#ffffff",
  edgeLabel: "#000000",
  abstractAccent: "#000000",
  packageFill: "none",
  packageStroke: "#000000",
  packageLabel: "#000000"
};
var DARK_UMLCLASS = {
  classifierFill: "#172033",
  classifierStroke: "#f8fafc",
  headerFill: "#202b3d",
  nameText: "#f8fafc",
  stereotypeText: "#cbd5e1",
  memberText: "#f8fafc",
  visibilityText: "#cbd5e1",
  relationStroke: "#f8fafc",
  adornmentFill: "#f8fafc",
  adornmentHollowFill: "#172033",
  edgeLabel: "#e2e8f0",
  abstractAccent: "#6d8fff",
  packageFill: "rgba(205,214,244,0.05)",
  packageStroke: "#64748b",
  packageLabel: "#cbd5e1"
};
var UMLCLASS_TOKENS = {
  default: DEFAULT_UMLCLASS,
  monochrome: MONOCHROME_UMLCLASS,
  dark: DARK_UMLCLASS
};
function resolveUmlClassTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...UMLCLASS_TOKENS[themeName] };
}
var DEFAULT_BPMN = {
  bpmnStroke: "#334155",
  bpmnText: "#0f172a",
  poolFill: "#ffffff",
  laneFill: "#fbfcfe",
  labelBandFill: "#eef2f7",
  taskFill: "#eff6ff",
  // blue-50 — "work happens here"
  taskStroke: "#3b82f6",
  // blue-500
  gatewayFill: "#fef3c7",
  // amber-100 — de-facto gateway yellow
  gatewayStroke: "#d97706",
  // amber-600
  gatewayGlyph: "#92400e",
  // amber-800
  startFill: "#dcfce7",
  // green-100 — de-facto start green
  startStroke: "#059669",
  endFill: "#fee2e2",
  // red-100 — de-facto end red
  endStroke: "#dc2626",
  intermediateFill: "#ffffff",
  intermediateStroke: "#334155",
  flowStroke: "#334155",
  msgFlowStroke: "#94a3b8"
};
var MONOCHROME_BPMN = {
  bpmnStroke: "#000000",
  bpmnText: "#000000",
  poolFill: "#ffffff",
  laneFill: "#ffffff",
  labelBandFill: "#f0f0f0",
  taskFill: "#ffffff",
  taskStroke: "#000000",
  gatewayFill: "#ffffff",
  gatewayStroke: "#000000",
  gatewayGlyph: "#000000",
  startFill: "#ffffff",
  startStroke: "#000000",
  endFill: "#ffffff",
  endStroke: "#000000",
  intermediateFill: "#ffffff",
  intermediateStroke: "#000000",
  flowStroke: "#000000",
  msgFlowStroke: "#555555"
};
var DARK_BPMN = {
  bpmnStroke: "#f8fafc",
  bpmnText: "#f8fafc",
  poolFill: "#0f172a",
  laneFill: "#272736",
  labelBandFill: "#172033",
  taskFill: "#1e3a5f",
  taskStroke: "#6d8fff",
  gatewayFill: "#45413a",
  gatewayStroke: "#facc15",
  gatewayGlyph: "#facc15",
  startFill: "#1e3a2a",
  startStroke: "#34d399",
  endFill: "#3a231f",
  endStroke: "#f87171",
  intermediateFill: "#172033",
  intermediateStroke: "#f8fafc",
  flowStroke: "#f8fafc",
  msgFlowStroke: "#94a3b8"
};
var BPMN_TOKENS = {
  default: DEFAULT_BPMN,
  monochrome: MONOCHROME_BPMN,
  dark: DARK_BPMN
};
function resolveBpmnTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...BPMN_TOKENS[themeName] };
}
var DEFAULT_STATE = {
  stateFill: "#ffffff",
  stateStroke: "#334155",
  stateText: "#0f172a",
  activityText: "#475569",
  compositeFill: "#f8fafc",
  compositeTitlebar: "#eef2f7",
  regionDiv: "#94a3b8",
  psInk: "#0f172a",
  transitionStroke: "#334155",
  transitionLabel: "#0f172a",
  labelBg: "#ffffff",
  noteFill: "#fef9c3",
  noteStroke: "#ca8a04",
  noteText: "#374151"
};
var MONOCHROME_STATE = {
  stateFill: "#ffffff",
  stateStroke: "#000000",
  stateText: "#000000",
  activityText: "#333333",
  compositeFill: "#ffffff",
  compositeTitlebar: "#f0f0f0",
  regionDiv: "#888888",
  psInk: "#000000",
  transitionStroke: "#000000",
  transitionLabel: "#000000",
  labelBg: "#ffffff",
  noteFill: "#ffffff",
  noteStroke: "#000000",
  noteText: "#000000"
};
var DARK_STATE = {
  stateFill: "#172033",
  stateStroke: "#f8fafc",
  stateText: "#f8fafc",
  activityText: "#cbd5e1",
  compositeFill: "#272736",
  compositeTitlebar: "#172033",
  regionDiv: "#64748b",
  psInk: "#f8fafc",
  transitionStroke: "#f8fafc",
  transitionLabel: "#f8fafc",
  labelBg: "#0f172a",
  noteFill: "#45413a",
  noteStroke: "#facc15",
  noteText: "#f8fafc"
};
var STATE_TOKENS = {
  default: DEFAULT_STATE,
  monochrome: MONOCHROME_STATE,
  dark: DARK_STATE
};
function resolveStateTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...STATE_TOKENS[themeName] };
}
var DEFAULT_MATRIX = {
  inkStrong: "#111827",
  ink: "#1f2937",
  inkMuted: "#374151",
  inkFaint: "#6b7280",
  gridFaint: "#e5e7eb",
  grid: "#d1d5db",
  gridMid: "#cbd5e1",
  gridStrong: "#94a3b8",
  border: "#374151",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  surfaceTint: "#f0fdf4",
  cornerFill: "#f1f5f9",
  headerFill: "#e2e8f0",
  accent: "#2563eb",
  accentSoft: "#93c5fd",
  accentTint: "#eff6ff",
  accentDeep: "#1e3a8a",
  roofFilled: "#eef2ff",
  positive: "#16a34a",
  positiveDeep: "#15803d",
  negative: "#dc2626",
  negativeDeep: "#b91c1c",
  warnDeep: "#ea580c",
  onHeader: "#ffffff"
};
var MONOCHROME_MATRIX = {
  inkStrong: "#000000",
  ink: "#000000",
  inkMuted: "#333333",
  inkFaint: "#555555",
  gridFaint: "#dddddd",
  grid: "#bbbbbb",
  gridMid: "#aaaaaa",
  gridStrong: "#777777",
  border: "#000000",
  surface: "#ffffff",
  surfaceAlt: "#f7f7f7",
  surfaceTint: "#f0f0f0",
  cornerFill: "#f0f0f0",
  headerFill: "#e5e5e5",
  accent: "#000000",
  accentSoft: "#bbbbbb",
  accentTint: "#f0f0f0",
  accentDeep: "#000000",
  roofFilled: "#e5e5e5",
  positive: "#000000",
  positiveDeep: "#000000",
  negative: "#000000",
  negativeDeep: "#000000",
  warnDeep: "#000000",
  onHeader: "#ffffff"
};
var DARK_MATRIX = {
  inkStrong: "#f8fafc",
  ink: "#f8fafc",
  inkMuted: "#e2e8f0",
  inkFaint: "#cbd5e1",
  gridFaint: "#172033",
  grid: "#202b3d",
  gridMid: "#202b3d",
  gridStrong: "#64748b",
  border: "#f8fafc",
  surface: "#0f172a",
  surfaceAlt: "#272736",
  surfaceTint: "rgba(52,211,153,0.08)",
  cornerFill: "#172033",
  headerFill: "#202b3d",
  accent: "#6d8fff",
  accentSoft: "#45557a",
  accentTint: "#1e3a5f",
  accentDeep: "#6d8fff",
  roofFilled: "#2a2a45",
  positive: "#34d399",
  positiveDeep: "#34d399",
  negative: "#f87171",
  negativeDeep: "#f87171",
  warnDeep: "#fbbf24",
  onHeader: "#0f172a"
};
var MATRIX_TOKENS = {
  default: DEFAULT_MATRIX,
  monochrome: MONOCHROME_MATRIX,
  dark: DARK_MATRIX
};
function resolveMatrixTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...MATRIX_TOKENS[themeName] };
}
var DEFAULT_BLOCK = {
  blockStroke: "#334155",
  blockText: "#0f172a",
  blockName: "#64748b",
  sumFill: "#ffffff",
  signalStroke: "#334155",
  roleFills: {
    plant: "#ffffff",
    controller: "#dbeafe",
    sensor: "#f3e8ff",
    actuator: "#dcfce7",
    filter: "#fef9c3",
    reference: "#ffffff",
    disturbance: "#ffedd5",
    generic: "#ffffff"
  }
};
var MONOCHROME_BLOCK = {
  blockStroke: "#000000",
  blockText: "#000000",
  blockName: "#333333",
  sumFill: "#ffffff",
  signalStroke: "#000000",
  roleFills: {
    plant: "#ffffff",
    controller: "#ffffff",
    sensor: "#ffffff",
    actuator: "#ffffff",
    filter: "#ffffff",
    reference: "#ffffff",
    disturbance: "#ffffff",
    generic: "#ffffff"
  }
};
var DARK_BLOCK = {
  blockStroke: "#f8fafc",
  blockText: "#f8fafc",
  blockName: "#cbd5e1",
  sumFill: "#172033",
  signalStroke: "#f8fafc",
  roleFills: {
    plant: "#172033",
    controller: "#1e3a5f",
    sensor: "#2e2a52",
    actuator: "#1e3a2a",
    filter: "#3a3326",
    reference: "#172033",
    disturbance: "#3a2d1a",
    generic: "#172033"
  }
};
var BLOCK_TOKENS = {
  default: DEFAULT_BLOCK,
  monochrome: MONOCHROME_BLOCK,
  dark: DARK_BLOCK
};
function resolveBlockTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...BLOCK_TOKENS[themeName] };
}
function resolveBaseTheme(name) {
  return BASE_THEMES[name] ?? BASE_THEMES["default"];
}
function resolvePersonTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...PERSON_TOKENS[themeName] };
}
function resolveBiologyTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...BIOLOGY_TOKENS[themeName] };
}
function resolveFishboneTheme(name) {
  return resolveBaseTheme(name);
}
function resolveVennTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...VENN_TOKENS[themeName] };
}
var DEFAULT_FLOORPLAN = {
  wallFill: "#1e293b",
  floorFill: "#ffffff",
  furnStroke: "#475569",
  furnFill: "#ffffff",
  furnSolid: "#334155",
  boardInner: "#ffffff",
  chairFill: "#f1f5f9",
  doorLeaf: "#334155",
  doorArc: "#94a3b8",
  windowStroke: "#334155",
  rugStroke: "#94a3b8",
  hatchStroke: "#cbd5e1",
  roomName: "#0f172a",
  roomArea: "#64748b",
  furnLabel: "#475569",
  dimStroke: "#94a3b8",
  dimText: "#64748b"
};
var MONOCHROME_FLOORPLAN = {
  wallFill: "#000000",
  floorFill: "#ffffff",
  furnStroke: "#000000",
  furnFill: "#ffffff",
  furnSolid: "#000000",
  boardInner: "#ffffff",
  chairFill: "#ffffff",
  doorLeaf: "#000000",
  doorArc: "#555555",
  windowStroke: "#000000",
  rugStroke: "#777777",
  hatchStroke: "#bbbbbb",
  roomName: "#000000",
  roomArea: "#444444",
  furnLabel: "#222222",
  dimStroke: "#666666",
  dimText: "#333333"
};
var FLOORPLAN_TOKENS = {
  default: DEFAULT_FLOORPLAN,
  monochrome: MONOCHROME_FLOORPLAN,
  // No dark floor plans — paper notation stays light even in dark mode.
  dark: DEFAULT_FLOORPLAN
};
function resolveFloorplanTheme(name) {
  const themeName = name === "monochrome" ? "monochrome" : "default";
  return { ...BASE_THEMES[themeName], ...FLOORPLAN_TOKENS[themeName] };
}
var DEFAULT_PLAYBOOK = {
  surface: "#2f8f4e",
  // broadcast grass green
  surfaceAlt: "#2b8549",
  // darker mow stripe
  surround: "#21683a",
  // out-of-bounds grass band
  courtSurface: "#f1ddba",
  // light maple hardwood
  courtLine: "#b07c40",
  // warm court-line brown
  courtSurround: "#6b4f2c",
  // arena apron (mid wood)
  courtText: "#7a5526",
  lineSoft: "rgba(255,255,255,0.62)",
  lineBold: "#ffffff",
  offenseFill: "#ffffff",
  offenseStroke: "#13294b",
  // navy
  offenseLabel: "#13294b",
  gkFill: "#facc15",
  // keeper yellow
  defenseStroke: "#ef4444",
  // red
  defenseLabel: "#fee2e2",
  moveStroke: "#0b1f3a",
  // dark navy ink — reads on green
  motionStroke: "#e2e8f0",
  shotStroke: "#f59e0b",
  // amber shot
  zoneStroke: "#fde047",
  zoneFill: "rgba(253,224,71,0.12)",
  ballFill: "#7c3a14",
  endzoneFill: "rgba(255,255,255,0.10)",
  goalAccent: "#fcd34d",
  // goalpost gold
  rim: "#f97316",
  surfaceText: "rgba(255,255,255,0.85)",
  annotation: "#334155"
};
var MONOCHROME_PLAYBOOK = {
  surface: "#ffffff",
  surfaceAlt: "#f6f6f6",
  surround: "#e6e6e6",
  courtSurface: "#ffffff",
  courtLine: "#000000",
  courtSurround: "#e6e6e6",
  courtText: "#333333",
  lineSoft: "#cbcbcb",
  lineBold: "#000000",
  offenseFill: "#ffffff",
  offenseStroke: "#000000",
  offenseLabel: "#000000",
  gkFill: "#ffffff",
  defenseStroke: "#000000",
  defenseLabel: "#000000",
  moveStroke: "#000000",
  motionStroke: "#666666",
  shotStroke: "#000000",
  zoneStroke: "#000000",
  zoneFill: "none",
  ballFill: "#000000",
  endzoneFill: "rgba(0,0,0,0.06)",
  goalAccent: "#000000",
  rim: "#000000",
  surfaceText: "#333333",
  annotation: "#000000"
};
var DARK_PLAYBOOK = {
  surface: "#16331f",
  // night-game turf
  surfaceAlt: "#143019",
  surround: "#0e2415",
  courtSurface: "#6f5232",
  // dim hardwood
  courtLine: "#caa46a",
  courtSurround: "#1c140b",
  courtText: "#caa46a",
  lineSoft: "rgba(226,240,230,0.45)",
  lineBold: "#e8f3ec",
  offenseFill: "#e8f3ec",
  offenseStroke: "#0b1f3a",
  offenseLabel: "#0b1f3a",
  gkFill: "#facc15",
  defenseStroke: "#f87171",
  defenseLabel: "#fee2e2",
  moveStroke: "#0b1f3a",
  motionStroke: "#cbd5e1",
  shotStroke: "#fbbf24",
  zoneStroke: "#fde047",
  zoneFill: "rgba(253,224,71,0.14)",
  ballFill: "#cba37a",
  endzoneFill: "rgba(255,255,255,0.08)",
  goalAccent: "#fcd34d",
  rim: "#fb923c",
  surfaceText: "rgba(232,243,236,0.85)",
  annotation: "#f8fafc"
};
var PLAYBOOK_TOKENS = {
  default: DEFAULT_PLAYBOOK,
  monochrome: MONOCHROME_PLAYBOOK,
  dark: DARK_PLAYBOOK
};
function resolvePlaybookTheme(name) {
  const themeName = name in BASE_THEMES ? name : "default";
  return { ...BASE_THEMES[themeName], ...PLAYBOOK_TOKENS[themeName] };
}
var GENOGRAM_ALIASES = {
  clinical: "monochrome",
  colorful: "default",
  mono: "monochrome",
  bw: "monochrome"
};
function resolveGenogramTheme(name) {
  const resolved = GENOGRAM_ALIASES[name] ?? name;
  return resolvePersonTheme(resolved);
}
var FONT_SIZE = {
  title: 16,
  label: 12,
  small: 9
};
var TITLE = {
  size: FONT_SIZE.title,
  weight: 700,
  /** Baseline y within the title band. */
  y: 24,
  /** Total height a layout should reserve above content for the title. */
  bandH: 40
};
var STROKE_WIDTH = {
  thin: 1,
  normal: 2,
  thick: 3
};
var DEFAULT_FONT_FAMILY = "system-ui, -apple-system, sans-serif";
function cssCustomProperties(theme) {
  const t = theme ?? BASE_THEMES["default"];
  return `
  --schematex-bg: ${t.bg};
  --schematex-text: ${t.text};
  --schematex-text-muted: ${t.textMuted};
  --schematex-stroke: ${t.stroke};
  --schematex-fill: ${t.fill};
  --schematex-fill-muted: ${t.fillMuted};
  --schematex-accent: ${t.accent};
  --schematex-positive: ${t.positive};
  --schematex-negative: ${t.negative};
  --schematex-neutral: ${t.neutral};
  --schematex-warn: ${t.warn};
  --schematex-font-title: ${FONT_SIZE.title}px;
  --schematex-font-label: ${FONT_SIZE.label}px;
  --schematex-font-small: ${FONT_SIZE.small}px;
  --schematex-stroke-thin: ${STROKE_WIDTH.thin};
  --schematex-stroke-normal: ${STROKE_WIDTH.normal};
  --schematex-stroke-thick: ${STROKE_WIDTH.thick};`;
}

// src/core/svg.ts
var ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;"
};
function escapeXml(str) {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}
function formatAttrs(attrs) {
  return Object.entries(attrs).filter(([, v]) => v !== void 0).map(([k, v]) => `${k}="${escapeXml(String(v))}"`).join(" ");
}
function el(tag, attrs, children) {
  const attrStr = formatAttrs(attrs);
  const open = attrStr ? `<${tag} ${attrStr}` : `<${tag}`;
  if (children === void 0) {
    return `${open}/>`;
  }
  const content = Array.isArray(children) ? children.join("\n") : children;
  return `${open}>${content}</${tag}>`;
}
function svgRoot(attrs, children) {
  return el(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
      ...attrs
    },
    children
  );
}
function defs(children) {
  return el("defs", {}, children);
}
function group(attrs, children) {
  return el("g", attrs, children);
}
function rect(attrs) {
  return el("rect", attrs);
}
function circle(attrs) {
  return el("circle", attrs);
}
function line(attrs) {
  return el("line", attrs);
}
function path(attrs) {
  return el("path", attrs);
}
function text(attrs, content) {
  return el("text", attrs, escapeXml(content));
}
function parseInlineSegments(line2) {
  const out = [];
  let bold = false;
  let italic = false;
  let buf = "";
  let i = 0;
  while (i < line2.length) {
    const rest = line2.slice(i);
    const m = /^<(\/?)([bi])>/i.exec(rest);
    if (m) {
      if (buf) {
        out.push({ text: buf, bold, italic });
        buf = "";
      }
      const isClose = m[1] === "/";
      const tag = m[2].toLowerCase();
      if (tag === "b") bold = !isClose;
      else italic = !isClose;
      i += m[0].length;
    } else {
      buf += line2[i];
      i++;
    }
  }
  if (buf) out.push({ text: buf, bold, italic });
  return out;
}
function segmentTspan(seg, extra) {
  const a = { ...extra };
  if (seg.bold) a["font-weight"] = "bold";
  if (seg.italic) a["font-style"] = "italic";
  return el("tspan", a, escapeXml(seg.text));
}
function multilineText(attrs, content, lineHeight = 14) {
  const lines = String(content).split(/<br\s*\/?>|\n/i);
  const total = (lines.length - 1) * lineHeight;
  const tspans = [];
  lines.forEach((ln, lineIdx) => {
    const segs = parseInlineSegments(ln);
    const rendered = segs.length === 0 ? [{ text: "", bold: false, italic: false }] : segs;
    rendered.forEach((seg, segIdx) => {
      const extra = {};
      if (segIdx === 0) {
        extra.x = attrs.x;
        extra.dy = lineIdx === 0 ? -total / 2 : lineHeight;
      }
      tspans.push(segmentTspan(seg, extra));
    });
  });
  return el("text", attrs, tspans.join(""));
}
function title(content) {
  return el("title", {}, escapeXml(content));
}
function desc(content) {
  return el("desc", {}, escapeXml(content));
}
function pattern(attrs, children) {
  return el("pattern", attrs, children);
}
function polygon(attrs) {
  return el("polygon", attrs);
}

export { BASE_THEMES, BIOLOGY_TOKENS, DEFAULT_FONT_FAMILY, FONT_SIZE, NETWORK_TOKENS, PERSON_TOKENS, PETRI_TOKENS, STROKE_WIDTH, TITLE, VENN_TOKENS, circle, cssCustomProperties, defs, desc, el, escapeXml, group, line, multilineText, path, pattern, polygon, rect, resolveBaseTheme, resolveBiologyTheme, resolveBlockTheme, resolveBowtieTheme, resolveBpmnTheme, resolveComparisonTheme, resolveFishboneTheme, resolveFloorplanTheme, resolveFlowchartTheme, resolveGenogramTheme, resolveIndustrialTheme, resolveMatrixTheme, resolveMindmapTheme, resolveNetworkTheme, resolvePersonTheme, resolvePetriTheme, resolvePlaybookTheme, resolveReliabilityTheme, resolveStateTheme, resolveTimelineTheme, resolveUmlClassTheme, resolveVennTheme, svgRoot, text, title };
//# sourceMappingURL=chunk-ZUMTE4E7.js.map
//# sourceMappingURL=chunk-ZUMTE4E7.js.map