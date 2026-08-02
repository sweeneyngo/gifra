export function PawMark({ size = 24 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <ellipse cx="5.4" cy="11.9" rx="1.9" ry="2.5" />
      <ellipse cx="9.4" cy="7" rx="2" ry="2.7" />
      <ellipse cx="14.6" cy="7" rx="2" ry="2.7" />
      <ellipse cx="18.6" cy="11.9" rx="1.9" ry="2.5" />
      <path d="M12 13.4c-2.9 0-5.2 2.3-5.2 4.8 0 1.9 1.5 3 3.3 3 1 0 1.5-.4 1.9-.4s.9.4 1.9.4c1.8 0 3.3-1.1 3.3-3 0-2.5-2.3-4.8-5.2-4.8z" />
    </svg>
  );
}
