"use client";

import { useState } from "react";
import { InputHistory, PredictionArea, TokenCategory, TokenSlider } from "../components";
import axios from "axios";
import { Token, TokenizedArticle, PredictionToken } from "../types";
// カスタムCSS完全廃止: Tailwind CSS v4ユーティリティクラスのみ利用

export default function HiinAgent() {
  const [article, setArticle] = useState<TokenizedArticle | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [predicting, setPredicting] = useState<boolean>(false); // 追加: 予測中フラグ
  const [inputHistory, setInputHistory] = useState<Token[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [predictions, setPredictions] = useState<PredictionToken[]>([]);
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setInputHistory([]);
    setPredictions([]);
    setArticle(null);
    setActiveCategory("");
    try {
      const res = await axios.post("/api/morpho", { text });
      const tokenizedArticle = res.data;
      // categoriesやtokensByCategoryが空配列/空オブジェクトの場合はエラー扱い
      if (!tokenizedArticle || !Array.isArray(tokenizedArticle.categories) || tokenizedArticle.categories.length === 0 || !tokenizedArticle.tokensByCategory || Object.keys(tokenizedArticle.tokensByCategory).length === 0) {
        setError('解析結果が空です。記事本文を見直してください');
        setArticle(null);
        return;
      }
      setArticle(tokenizedArticle);
      setActiveCategory(tokenizedArticle.categories[0]);
    } catch (error) {
      setError('記事の解析に失敗しました');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelect = async (token: Token) => {
    if (!article) return;

    // 新しい履歴を設定
    const newHistory = [...inputHistory, token];
    setInputHistory(newHistory);

    setPredicting(true); // 予測中フラグON
    try {
      // 予測APIを呼び出す
      const res = await axios.post("/api/gemini", { history: newHistory, article });
      // console.log("APIレスポンス:", res.data);

      // レスポンスを検証
      if (Array.isArray(res.data) && res.data.length > 0) {
        const formattedPredictions = res.data.map((pred: any) => ({
          surface: pred.surface,
          category: pred.category,
          score: pred.score ?? 0,
        })) as PredictionToken[];
        setPredictions(formattedPredictions);
      } else {
        console.warn("APIからの予測が空でした");
        setPredictions([]);
      }
    } catch (error) {
      console.error('予測の取得に失敗しました:', error);
      setPredictions([]);
    } finally {
      setPredicting(false); // 予測中フラグOFF
    }
  };

  const handleCategoryChange = (direction: 'prev' | 'next') => {
    if (!article) return;
    const currentIndex = article.categories.indexOf(activeCategory);
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % article.categories.length;
    } else {
      newIndex = (currentIndex - 1 + article.categories.length) % article.categories.length;
    }
    setActiveCategory(article.categories[newIndex]);
  };

  const handleInputConfirm = () => {
    const text = inputHistory.map(token => token.surface).join('');
    alert(`入力が確定されました: ${text}`);
  };

  return (
    <div className="max-w-xl mx-auto p-6 font-sans">
      <div className="mb-4 w-full max-w-2xl">
        <label htmlFor="article-text" className="block mb-2 font-bold">記事本文を入力してください</label>
        <textarea
          id="article-text"
          className="w-full h-32 p-2 border rounded resize-y"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="ここに記事本文を貼り付けてください"
        />
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded font-bold shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
        >
          形態素解析して開始
        </button>
      </div>
      {loading && <div className="flex items-center justify-center p-5 text-lg text-gray-500">記事を解析中...</div>}
      {error && <div className="p-3 my-3 text-red-700 bg-red-50 border-l-4 border-red-400 rounded">{error}</div>}
      {article && !loading && (
        <>
          <InputHistory tokens={inputHistory} />
          {predicting ? (
            <div className="flex items-center justify-center p-5 text-lg text-gray-500 animate-pulse">
              AIが考え中...
            </div>
          ) : (
            <PredictionArea predictions={predictions} onSelect={handleTokenSelect} />
          )}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-50 border-t border-gray-200 shadow-lg max-w-xl mx-auto h-[100px] flex items-center px-4 gap-2">
            <TokenCategory 
              direction="prev" 
              activeCategory={activeCategory} 
              onChange={() => handleCategoryChange('prev')} 
            />
            <TokenSlider 
              tokens={Array.isArray(article.tokensByCategory[activeCategory]) ? article.tokensByCategory[activeCategory] : []}
              onSelect={handleTokenSelect}
            />
            <TokenCategory 
              direction="next" 
              activeCategory={activeCategory} 
              onChange={() => handleCategoryChange('next')} 
            />
            <button
              className="ml-2 w-16 h-10 bg-green-500 text-white rounded font-bold shadow-sm transition hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
              onClick={handleInputConfirm}
            >
              確定
            </button>
          </div>
        </>
      )}
    </div>
  );
}
// 旧Next.jsテンプレート部分・残骸を完全削除
