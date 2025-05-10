import { Token, TokenizedArticle } from '../types';
import * as kuromoji from 'kuromoji';


let tokenizerPromise: Promise<any> | null = null;

const initKuromoji = (): Promise<any> => {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err: any, tokenizer: any) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
};

export const analyzeText = async (text: string): Promise<TokenizedArticle> => {
  const tokenizer = await initKuromoji();
  const tokens = tokenizer.tokenize(text);

  const categorizeToken = (token: any): string => {
    const { pos, pos_detail_1, surface_form } = token;
    if (pos === '名詞' && pos_detail_1 === '固有名詞') return '固有名詞';
    if (/\d+月\d+日/.test(surface_form)) return '日付';
    if (/[！!？?、。（）()…]/.test(surface_form)) return '記号';
    if (/^[A-Za-z]+$/.test(surface_form)) return '英字';
    if (/\d/.test(surface_form)) return '数字';
    return '一般';
  };

  const allTokens: Token[] = tokens.map((token: any) => ({
    surface: token.surface_form,
    category: categorizeToken(token),
    reading: token.reading,
    pos: token.pos
  }));

  const tokensByCategory: Record<string, Token[]> = {};
  const categories: string[] = [];
  allTokens.forEach(token => {
    if (!tokensByCategory[token.category]) {
      tokensByCategory[token.category] = [];
      categories.push(token.category);
    }
    if (!tokensByCategory[token.category].some(t => t.surface === token.surface)) {
      tokensByCategory[token.category].push(token);
    }
  });

  return {
    categories,
    tokensByCategory,
    allTokens
  };
};
