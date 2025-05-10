interface TokenCategoryProps {
  direction: 'prev' | 'next';
  activeCategory: string;
  onChange: () => void;
}

const TokenCategory = ({ direction, activeCategory, onChange }: TokenCategoryProps) => {
  return (
    <button
      className={`w-16 flex flex-col items-center justify-center rounded bg-blue-500 text-white px-2 py-1 font-bold shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 ${direction === 'prev' ? 'mr-2' : 'ml-2'}`}
      onClick={onChange}
      aria-label={`${direction === 'prev' ? '前' : '次'}のカテゴリへ`}
    >
      <span className="text-lg">{direction === 'prev' ? '◀' : '▶'}</span>
      <span className="text-xs truncate max-w-[55px]">{activeCategory}</span>
    </button>
  );
};

export default TokenCategory;
