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
  nikkei225_index: {
    emoji: "📊",
    shortDesc: "日本を代表する225社の平均株価",
    ticker: null,
    exchange: "インデックス",
    iconBg: "#FFF0E8",
  },
  sanrio_stock: {
    emoji: "🎀",
    shortDesc: "ハローキティなどのキャラクターの会社",
    ticker: "8136",
    exchange: "東証プライム",
    iconBg: "#FFE8F0",
  },
  sega_sammy_stock: {
    emoji: "🕹️",
    shortDesc: "ゲームやアミューズメントの会社",
    ticker: "6460",
    exchange: "東証プライム",
    iconBg: "#EEF0FF",
  },
  kura_sushi_stock: {
    emoji: "🍣",
    shortDesc: "回転寿司のお店を全国に広げている会社",
    ticker: "2695",
    exchange: "東証プライム",
    iconBg: "#FFF4E0",
  },
  recruit_holdings_stock: {
    emoji: "💼",
    shortDesc: "求人や予約サービスを手がける会社",
    ticker: "6098",
    exchange: "東証プライム",
    iconBg: "#E8F4FF",
  },
  konami_group_stock: {
    emoji: "🎮",
    shortDesc: "ゲームやスポーツ施設の会社",
    ticker: "9766",
    exchange: "東証プライム",
    iconBg: "#EEF0FF",
  },
  aeon_stock: {
    emoji: "🛒",
    shortDesc: "全国にスーパーやモールを持つ会社",
    ticker: "8267",
    exchange: "東証プライム",
    iconBg: "#FFF0E8",
  },
  softbank_group_stock: {
    emoji: "📱",
    shortDesc: "通信や世界中への投資を手がける会社",
    ticker: "9984",
    exchange: "東証プライム",
    iconBg: "#E8F4FF",
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
