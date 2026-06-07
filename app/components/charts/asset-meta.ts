export type AssetMeta = {
  emoji: string;
  shortDesc: string;
  ticker: string | null;
  exchange: string;
  iconBg: string;
};

const META: Record<string, AssetMeta> = {
  nintendo_stock: {
    emoji: "🎮",
    shortDesc: "マリオやSwitchを作っている会社",
    ticker: "7974",
    exchange: "東証プライム",
    iconBg: "#FFE8E8",
  },
  toyota_motor_stock: {
    emoji: "🚗",
    shortDesc: "世界中で車を販売している会社",
    ticker: "7203",
    exchange: "東証プライム",
    iconBg: "#FFE8E8",
  },
  sony_group_stock: {
    emoji: "🎵",
    shortDesc: "ゲームや映画や音楽の会社",
    ticker: "6758",
    exchange: "東証プライム",
    iconBg: "#EEF0FF",
  },
  emaxis_slim_all_country: {
    emoji: "🌏",
    shortDesc: "全世界の会社にまとめて投資できる",
    ticker: null,
    exchange: "インデックスファンド",
    iconBg: "#E8F4FF",
  },
  emaxis_slim_us_sp500: {
    emoji: "🗽",
    shortDesc: "アメリカの代表的な500社に投資できる",
    ticker: null,
    exchange: "インデックスファンド",
    iconBg: "#E8EEFF",
  },
  emaxis_slim_domestic_topix: {
    emoji: "🗾",
    shortDesc: "日本の幅広い会社にまとめて投資できる",
    ticker: null,
    exchange: "インデックスファンド",
    iconBg: "#FFF0E8",
  },
  emaxis_slim_emerging: {
    emoji: "🌱",
    shortDesc: "成長中の国々の会社に幅広く投資できる",
    ticker: null,
    exchange: "インデックスファンド",
    iconBg: "#E8FFE8",
  },
  gold_spot_asset: {
    emoji: "✨",
    shortDesc: "世界で昔から価値を認められている金",
    ticker: null,
    exchange: "コモディティ",
    iconBg: "#FFF8E0",
  },
  silver_spot_asset: {
    emoji: "🌕",
    shortDesc: "工業にも使われる貴金属の銀",
    ticker: null,
    exchange: "コモディティ",
    iconBg: "#F2F2F8",
  },
  bitcoin_crypto: {
    emoji: "₿",
    shortDesc: "世界中で使われている仮想通貨",
    ticker: null,
    exchange: "仮想通貨",
    iconBg: "#FFF4E0",
  },
  ethereum_crypto: {
    emoji: "💎",
    shortDesc: "アプリの土台にもなる仮想通貨",
    ticker: null,
    exchange: "仮想通貨",
    iconBg: "#F0EEFF",
  },
};

const FALLBACK: AssetMeta = {
  emoji: "📈",
  shortDesc: "",
  ticker: null,
  exchange: "投資対象",
  iconBg: "#F0F9F2",
};

export function getAssetMeta(assetCode: string): AssetMeta {
  return META[assetCode] ?? FALLBACK;
}
