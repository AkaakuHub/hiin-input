import { NextRequest, NextResponse } from 'next/server';
import { analyzeText } from '../../../services/morphologicalService';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const result = await analyzeText(text);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: '解析エラー' }, { status: 500 });
  }
}
