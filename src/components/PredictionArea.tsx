import { Token } from '../types';

interface PredictionAreaProps {
  predictions: Array<{ surface: string; category: string; score: number }>; // APIレスポンスに対応
  onSelect: (token: { surface: string; category: string; score: number }) => void;
}

const PredictionArea = ({ predictions, onSelect }: PredictionAreaProps) => {
  // console.log("prediction", predictions);
  return (
    <div className="mb-4 p-3 rounded bg-green-50">
      <div className="mb-2 font-bold">次の候補:</div>
      <div className="flex flex-wrap gap-2">
        {predictions.length > 0 ? (
          predictions.map((token, index) => (
            <button
              key={index}
              className={`px-3 py-2 rounded text-base font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 ${getCategoryColor(token.category)}`}
              onClick={() => onSelect(token)}
            >
              {token.surface ? token.surface : '未定義'}
              <span className="ml-1 text-xs text-gray-500">({(token.score * 100).toFixed(1)}%)</span>
            </button>
          ))
        ) : (
          <span className="text-gray-400">候補はまだありません</span>
        )}
      </div>
    </div>
  );
}

// カテゴリ別色分け Tailwindクラス
function getCategoryColor(category: string) {
  switch (category) {
    case '固有名詞':
      return 'bg-blue-100';
    case '日付':
      return 'bg-green-100';
    case '記号':
      return 'bg-orange-100';
    case '英字':
      return 'bg-purple-100';
    case '数字':
      return 'bg-pink-100';
    case '一般':
      return 'bg-gray-200';
    default:
      return 'bg-gray-100';
  }
}

export default PredictionArea;
