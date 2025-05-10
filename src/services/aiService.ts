import { GoogleGenerativeAI } from '@google/generative-ai';
import { Token, TokenizedArticle } from '../types';

// APIキーの取得と検証
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
// console.log("APIキーの状態:", API_KEY ? "設定されています" : "未設定です");

const genAI = new GoogleGenerativeAI(API_KEY);

export const getPredictions = async (
  history: Token[],
  article: TokenizedArticle | null
): Promise<Token[]> => {
  if (!article || history.length === 0) return [];
  
  try {
    // 記事要約の作成 (トークンが10個以上ある場合のみ)
    const articleSummary = createArticleSummary(article);
    
    // 最近のトークン履歴（最大5つ）
    const recentTokens = history.slice(-5);
    const recentText = recentTokens.map(t => t.surface).join('');
    
    // トークン情報の強化 - 重要度スコア付与
    const enhancedTokens = enhanceTokensWithScore(article, history);
    
    // カテゴリの流れと最後のカテゴリ
    const recentCategories = recentTokens.map(t => t.category);
    const lastCategory = recentCategories[recentCategories.length - 1];
    
    // 各カテゴリの最重要トークン（スコア上位）を抽出
    const topTokensByCategory = getTopTokensByCategory(enhancedTokens);
    
    // Geminiモデルの設定と温度調整（より確信度の高い予測に）
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.2, // 低い温度で確信度の高い予測を促進
        topK: 40,
        topP: 0.95,
      }
    });
    
    // プロンプトを改善し、JSON形式での出力を明示的に指示
    const prompt = `
JSON: 以下は記事のこれまでのトークン列とカテゴリです。これに続く最も可能性の高い語句を3つ、確率付きで予測してください。

【これまでのトークンとカテゴリ】
${history.map((token, index) => `- "${token.surface}" (${token.category})`).join('\n')}

【記事の概要】
${articleSummary}

【指示】
1. 上記の文脈とトークン候補から、次に最も自然に続くと思われるトークンを3つ選んでください。
2. 回答は必ず以下のJSON形式のみで提供してください:

[
  {"token": "最適候補", "category": "カテゴリ名", "score": 0.9},
  {"token": "次善候補", "category": "カテゴリ名", "score": 0.8},
  {"token": "第三候補", "category": "カテゴリ名", "score": 0.7}
]
`;
    
    // console.log("Gemini APIにリクエスト送信中...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON抽出と解析の改善
    const jsonMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      try {
        const predictions = JSON.parse(jsonMatch[0]);
        // console.log("パース成功:", predictions);

        // 各候補に確率を含めた結果を返す
        const validPredictions = predictions
          .filter((pred: any) => pred.token && pred.category && typeof pred.score === 'number')
          .map((pred: any) => ({
            surface: pred.token,
            category: pred.category,
            score: pred.score
          }))
          .slice(0, 3);

        if (validPredictions.length > 0) {
          return validPredictions;
        } else {
          console.error('予測結果が無効なフォーマットです');
        }
      } catch (error) {
        console.error('予測結果のJSONパースに失敗:', error);
      }
    } else {
      console.error('レスポンス内にJSON形式の配列が見つかりません');
    }
    
    // フォールバック処理
    // console.log("フォールバック予測を生成します");
    return generateSmartFallback(history, article);
  } catch (error) {
    console.error('AI予測サービスでエラーが発生:', error);
    return generateSmartFallback(history, article);
  }
};

// 記事の概要を生成する関数
function createArticleSummary(article: TokenizedArticle): string {
  if (!article.allTokens || article.allTokens.length < 10) {
    return "記事情報が不足しています";
  }
  
  // 頻出トークンを抽出 (カテゴリ別)
  const categoryFrequency: Record<string, Record<string, number>> = {};
  
  article.allTokens.forEach(token => {
    if (!categoryFrequency[token.category]) {
      categoryFrequency[token.category] = {};
    }
    
    if (!categoryFrequency[token.category][token.surface]) {
      categoryFrequency[token.category][token.surface] = 0;
    }
    
    categoryFrequency[token.category][token.surface]++;
  });
  
  // カテゴリ別に頻出トークンを抽出
  let summary = "この記事には以下の主要要素が含まれています:\n";
  
  Object.entries(categoryFrequency).forEach(([category, tokens]) => {
    // 頻度でソート
    const sortedTokens = Object.entries(tokens)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // 各カテゴリ上位5つ
      .map(([token, freq]) => `${token}(${freq}回)`)
      .join(', ');
      
    if (sortedTokens) {
      summary += `- ${category}: ${sortedTokens}\n`;
    }
  });
  
  return summary;
}

// トークンに重要度スコアを付与
function enhanceTokensWithScore(
  article: TokenizedArticle, 
  history: Token[]
): Record<string, Token[]> {
  const result: Record<string, Token[]> = {};
  
  // 既に使用済みのトークン
  const usedSurfaces = new Set(history.map(t => t.surface));
  
  // 最後のトークンのカテゴリ (あれば)
  const lastCategory = history.length > 0 
    ? history[history.length - 1].category 
    : undefined;
  
  // カテゴリごとの出現頻度計算
  const categoryFrequency: Record<string, number> = {};
  article.allTokens.forEach(token => {
    if (!categoryFrequency[token.category]) {
      categoryFrequency[token.category] = 0;
    }
    categoryFrequency[token.category]++;
  });
  
  // 各カテゴリとトークンのスコアリング
  for (const category of article.categories) {
    // そのカテゴリのトークンを取得
    let categoryTokens = article.tokensByCategory[category] || [];
    
    // 使用済みトークンは除外
    categoryTokens = categoryTokens.filter(token => !usedSurfaces.has(token.surface));
    
    // トークンごとにスコア計算
    const scoredTokens = categoryTokens.map(token => {
      // 基本スコア (頻度ベース)
      let score = 0.5;
      
      // 同じトークンが記事内に複数回出現する場合はスコア上昇
      const frequency = article.allTokens.filter(t => t.surface === token.surface).length;
      score += Math.min(frequency / 10, 0.3); // 最大+0.3
      
      // 文脈に基づくボーナススコア
      if (lastCategory && lastCategory !== category) {
        // 異なるカテゴリは多様性のためスコア上昇
        score += 0.1;
        
        // カテゴリの自然な遷移パターンに基づくボーナス
        const naturalTransitions: Record<string, string[]> = {
          '固有名詞': ['記号', '日付', '一般'],
          '日付': ['記号', '固有名詞'],
          '記号': ['固有名詞', '一般'],
          '英字': ['記号', '一般'],
          '数字': ['記号', '日付'],
          '一般': ['記号', '固有名詞']
        };
        
        if (naturalTransitions[lastCategory]?.includes(category)) {
          score += 0.15; // 自然な遷移には大きなボーナス
        }
      }
      
      // スコアの正規化 (0.1-1.0の範囲に)
      score = Math.max(0.1, Math.min(1.0, score));
      
      return {
        ...token,
        score: Math.round(score * 100) / 100 // 小数点2位まで
      };
    });
    
    // スコア順に並べ替え
    result[category] = scoredTokens.sort((a, b) => b.score - a.score);
  }
  
  return result;
}

// 各カテゴリの上位トークンを取得
function getTopTokensByCategory(
  enhancedTokens: Record<string, Token[]>
): Record<string, Token[]> {
  const result: Record<string, Token[]> = {};
  
  Object.entries(enhancedTokens).forEach(([category, tokens]) => {
    // 各カテゴリの上位トークンを選別（最大7件）
    result[category] = tokens.slice(0, 7);
  });
  
  return result;
}

// 高度なフォールバック予測生成
function generateSmartFallback(
  history: Token[],
  article: TokenizedArticle
): Token[] {
  // console.log("高度なフォールバック予測を生成中...");
  
  // 履歴が空の場合
  if (history.length === 0) {
    return generateInitialSuggestions(article);
  }
  
  const lastToken = history[history.length - 1];
  
  // N-gramベースの予測（記事内の出現パターンから予測）
  const ngramPredictions = predictFromNgrams(history, article);
  if (ngramPredictions.length >= 3) {
    // console.log("N-gram予測を使用:", ngramPredictions);
    return ngramPredictions;
  }
  
  // カテゴリ遷移確率
  const transitions: Record<string, string[]> = {
    '固有名詞': ['記号', '日付', '一般'],
    '日付': ['記号', '固有名詞', '一般'],
    '記号': ['固有名詞', '一般', '日付'],
    '英字': ['記号', '一般', '固有名詞'],
    '数字': ['記号', '日付', '一般'],
    '一般': ['記号', '固有名詞', '日付']
  };
  
  // 次のカテゴリ候補
  const nextCategories = transitions[lastToken.category] || 
                       Object.keys(article.tokensByCategory);
  
  const predictions: Token[] = [];
  
  // 各カテゴリから最大1つずつ取得
  for (const category of nextCategories) {
    const categoryTokens = article.tokensByCategory[category] || [];
    if (categoryTokens.length > 0) {
      // すでに入力された内容と同じトークンは避ける
      const unusedTokens = categoryTokens.filter(
        t => !history.some(h => h.surface === t.surface)
      );
      
      if (unusedTokens.length > 0) {
        // 頻度順に並べ替え
        const tokenFreq = unusedTokens.map(token => {
          const freq = article.allTokens.filter(t => t.surface === token.surface).length;
          return { token, freq };
        }).sort((a, b) => b.freq - a.freq);
        
        // 頻度の高いものを優先
        predictions.push({
          ...tokenFreq[0].token,
          score: 0.8 - (predictions.length * 0.2)
        });
      }
      
      if (predictions.length >= 3) break;
    }
  }
  
  // 足りない場合は頻度ベースで補完
  if (predictions.length < 3) {
    const frequentTokens = getFrequentTokens(article, history, 3 - predictions.length);
    predictions.push(...frequentTokens);
  }
  
  return predictions;
}

// N-gramパターンからの予測
function predictFromNgrams(
  history: Token[],
  article: TokenizedArticle
): Token[] {
  if (history.length < 1) return [];
  
  // 最後の1〜2トークンのパターンを使用
  const pattern = history.slice(-Math.min(2, history.length))
    .map(t => t.surface).join('');
  
  // 記事内でこのパターンの次に来るトークンを探す
  const predictions: Record<string, {token: Token, score: number}> = {};
  
  // すでに使われたトークンを除外
  const usedSurfaces = new Set(history.map(t => t.surface));
  
  // 記事中のトークン列からN-gramを構築して次のトークンを予測
  for (let i = 0; i < article.allTokens.length - pattern.length; i++) {
    const currentPattern = article.allTokens.slice(i, i + pattern.length)
      .map(t => t.surface).join('');
      
    if (currentPattern === pattern && i + pattern.length < article.allTokens.length) {
      const nextToken = article.allTokens[i + pattern.length];
      
      // すでに使用済みのトークンはスキップ
      if (usedSurfaces.has(nextToken.surface)) continue;
      
      const key = nextToken.surface + nextToken.category;
      
      if (!predictions[key]) {
        predictions[key] = { 
          token: nextToken, 
          score: 0.5
        };
      } else {
        // 同じパターンで複数回出現する場合はスコア上昇
        predictions[key].score = Math.min(predictions[key].score + 0.2, 1.0);
      }
    }
  }
  
  // 予測結果をスコア順にソート
  return Object.values(predictions)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(p => ({
      ...p.token,
      score: p.score
    }));
}

// 最初の提案を生成（履歴なし時）
function generateInitialSuggestions(article: TokenizedArticle): Token[] {
  // 記事の最初の方に出てくるトークンを優先
  const initialTokens = article.allTokens.slice(0, Math.min(10, article.allTokens.length));
  
  // カテゴリの多様性を確保
  const suggestions: Token[] = [];
  const usedCategories = new Set<string>();
  
  for (const token of initialTokens) {
    if (!usedCategories.has(token.category) && suggestions.length < 3) {
      suggestions.push({
        ...token,
        score: 0.9 - (suggestions.length * 0.1)
      });
      usedCategories.add(token.category);
    }
    
    if (suggestions.length >= 3) break;
  }
  
  // 足りない場合は頻度ベースで補完
  if (suggestions.length < 3) {
    const emptyHistory: Token[] = [];
    const additionalTokens = getFrequentTokens(article, emptyHistory, 3 - suggestions.length);
    suggestions.push(...additionalTokens);
  }
  
  return suggestions;
}

// 頻出トークンを取得
function getFrequentTokens(
  article: TokenizedArticle, 
  history: Token[], 
  count: number
): Token[] {
  const result: Token[] = [];
  
  // 使用済みトークンを除外
  const usedSurfaces = new Set(history.map(t => t.surface));
  
  // トークンの出現回数をカウント
  const tokenFrequency: Record<string, {token: Token, freq: number}> = {};
  
  for (const token of article.allTokens) {
    if (usedSurfaces.has(token.surface)) continue;
    
    const key = `${token.surface}:${token.category}`;
    
    if (!tokenFrequency[key]) {
      tokenFrequency[key] = { token, freq: 0 };
    }
    
    tokenFrequency[key].freq++;
  }
  
  // 頻度でソート
  const sortedTokens = Object.values(tokenFrequency)
    .sort((a, b) => b.freq - a.freq)
    .slice(0, count);
    
  for (let i = 0; i < sortedTokens.length; i++) {
    result.push({
      ...sortedTokens[i].token,
      score: 0.7 - (i * 0.1)
    });
  }
  
  return result;
}
