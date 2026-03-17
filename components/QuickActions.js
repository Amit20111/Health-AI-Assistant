'use client';

export default function QuickActions({ visible, onChipClick }) {
  if (!visible) return null;

  const chips = [
    '🍎 Healthy breakfast ideas',
    '📋 Weekly meal plan',
    '💪 Calculate my BMI',
    '🥑 Low-carb groceries',
  ];

  return (
    <div className="quick-actions" aria-label="Suggested prompts">
      {chips.map((text) => (
        <button
          key={text}
          className="chip"
          type="button"
          onClick={() => onChipClick(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
