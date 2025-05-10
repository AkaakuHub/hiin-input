export interface Token {
  surface: string;      // 表層形
  category: string;     // カテゴリー (固有名詞, 日付, 記号など)
  reading?: string;     // 読み方
  pos?: string;         // 品詞
  score?: number;       // スコアをオプショナルで追加
}

export interface PredictionToken {
  surface: string;
  category: string;
  score: number;
}

export interface TokenizedArticle {
  categories: string[];
  tokensByCategory: Record<string, Token[]>;
  allTokens: Token[];
}
