export default function VanshLinkLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 32V21M20 23L9 13M20 23L31 13M20 21V8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="7" r="4" fill="currentColor" />
      <circle cx="8" cy="12" r="4" fill="currentColor" />
      <circle cx="32" cy="12" r="4" fill="currentColor" />
      <path d="M12 34H28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
