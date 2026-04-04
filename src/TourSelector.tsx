export interface Tour {
  id: string;
  label: string;
  description: string;
}

interface TourSelectorProps {
  tours: Tour[];
  onSelect: (tourId: string) => void;
}

export function TourSelector({ tours, onSelect }: TourSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
      {tours.map((tour) => (
        <button
          key={tour.id}
          onClick={() => onSelect(tour.id)}
          className="p-3 rounded-lg border border-gray-700 hover:border-accent text-left transition-colors"
        >
          <span className="text-sm font-medium text-accent">{tour.label}</span>
          <span className="text-xs text-text-secondary ml-2">
            {tour.description}
          </span>
        </button>
      ))}
    </div>
  );
}
