import { useState, useRef, TouchEvent } from 'react';
import { Token } from '../types';

interface TokenSliderProps {
  tokens: Token[];
  onSelect: (token: Token) => void;
}

const TokenSlider = ({ tokens, onSelect }: TokenSliderProps) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    setStartX(e.touches[0].clientX);
    if (sliderRef.current) {
      setScrollLeft(sliderRef.current.scrollLeft);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!startX || !sliderRef.current) return;
    const x = e.touches[0].clientX;
    const dist = startX - x;
    sliderRef.current.scrollLeft = scrollLeft + dist;
    e.preventDefault();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setStartX(null);
    if (Math.abs(sliderRef.current!.scrollLeft - scrollLeft) < 10) {
      const touchX = e.changedTouches[0].clientX;
      const elements = document.elementsFromPoint(touchX, e.changedTouches[0].clientY);
      for (const element of elements) {
        if (element.classList.contains('token-item')) {
          const index = parseInt(element.getAttribute('data-index') || '-1', 10);
          if (index >= 0 && tokens[index]) {
            onSelect(tokens[index]);
            break;
          }
        }
      }
    }
  };

  return (
    <div
      className="flex flex-1 gap-2 px-0 py-2 overflow-x-auto whitespace-nowrap"
      ref={sliderRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {tokens.map((token, index) => (
        <div
          key={index}
          className={`inline-flex items-center px-4 py-2 bg-white rounded-full border border-gray-300 shadow-sm cursor-pointer select-none transition hover:bg-gray-100 text-base font-medium`}
          data-index={index}
          onClick={() => onSelect(token)}
        >
          {token.surface}
        </div>
      ))}
    </div>
  );
};

export default TokenSlider;
