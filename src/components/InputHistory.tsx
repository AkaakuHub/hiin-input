import { Token } from '../types';

interface InputHistoryProps {
  tokens: Token[];
}

const InputHistory = ({ tokens }: InputHistoryProps) => {
  return (
    <div className="mb-4 p-3 rounded bg-gray-50">
      <div className="mb-2 font-bold">入力済みテキスト:</div>
      <div className="flex flex-wrap gap-1">
        {tokens.length > 0 ? (
          tokens.map((token, index) => (
            <span
              key={index}
              className={`px-2 py-1 rounded text-sm font-medium ${getCategoryColor(token.category)}`}
            >
              {token.surface}
            </span>
          ))
        ) : (
          <span className="text-gray-400">トークンを選択してください</span>
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

export default InputHistory;
