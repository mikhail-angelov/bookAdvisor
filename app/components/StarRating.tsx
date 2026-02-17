interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ rating, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${sizes[size]} ${
            star <= rating ? 'text-yellow-400' : 'text-gray-300'
          } ${
            !readonly && 'hover:scale-110 transition-transform cursor-pointer'
          } ${readonly && 'cursor-default'}`}
          aria-label={`Rate ${star} out of 5 stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
