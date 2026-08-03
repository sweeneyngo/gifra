// Shared admin "edit" pencil used on both the Games and Wishlist cards.
export const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="edit-btn" onClick={onClick} aria-label="Edit" title="Edit">
      <EditIcon />
    </button>
  );
}
