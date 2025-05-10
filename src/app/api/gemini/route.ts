import { NextRequest, NextResponse } from 'next/server';
import { getPredictions } from '../../../services/aiService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { history, article } = body;
    
    // console.log("Gemini API リクエスト受信:", { 
    //   historyLength: history?.length,
    //   articleData: article ? {
    //     categoriesCount: article.categories?.length,
    //     tokensCount: article.allTokens?.length
    //   } : null
    // });
    
    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ 
        error: '有効な履歴データがありません',
        detail: 'history配列が空または無効です'
      }, { status: 400 });
    }
    
    if (!article || !article.categories || !article.tokensByCategory) {
      return NextResponse.json({ 
        error: '有効な記事データがありません',
        detail: 'article、categories、またはtokensByCategoryが無効です'
      }, { status: 400 });
    }
    
    const result = await getPredictions(history, article);
    // console.log("予測結果:", result);
    
    // 予測結果の検証
    if (!Array.isArray(result) || result.length === 0) {
      console.warn("予測が空でした。フォールバックを使用します");
      // 完全にからの配列を返さない - 常に何らかの候補を返す
      return NextResponse.json([
        { surface: "予測", category: "一般", score: 0.7 },
        { surface: "候補", category: "一般", score: 0.5 },
        { surface: "生成", category: "一般", score: 0.3 }
      ]);
    }
    
    return NextResponse.json(result);
  } catch (e) {
    console.error("Gemini API エラー:", e);
    return NextResponse.json({ 
      error: 'AI予測エラー',
      detail: e instanceof Error ? e.message : '不明なエラー'
    }, { status: 500 });
  }
}
