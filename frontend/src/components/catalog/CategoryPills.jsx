import React from 'react';

export default function CategoryPills({ categories = [], selectedCategory, onSelectCategory }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      overflowX: 'auto',
      paddingBottom: '0.6rem',
      scrollbarWidth: 'none',
      marginBottom: '1.5rem'
    }}>
      <button
        onClick={() => onSelectCategory(null)}
        style={{
          padding: '0.5rem 1.1rem',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.88rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          border: '1px solid',
          borderColor: selectedCategory === null ? 'var(--maroon-primary)' : 'var(--border-subtle)',
          background: selectedCategory === null ? 'var(--maroon-primary)' : '#FFFFFF',
          color: selectedCategory === null ? '#FFFFFF' : 'var(--text-secondary)',
          boxShadow: selectedCategory === null ? '0 2px 8px rgba(122, 28, 28, 0.2)' : 'none'
        }}
      >
        All Sweets
      </button>

      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.88rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid',
              borderColor: isSelected ? 'var(--maroon-primary)' : 'var(--border-subtle)',
              background: isSelected ? 'var(--maroon-primary)' : '#FFFFFF',
              color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
              boxShadow: isSelected ? '0 2px 8px rgba(122, 28, 28, 0.2)' : 'none'
            }}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
