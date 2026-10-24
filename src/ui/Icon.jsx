const ICONS = {
  code: (
    <>
      <polyline points="8,6 2,12 8,18" />
      <polyline points="16,6 22,12 16,18" />
      <line x1="13.5" y1="4" x2="10.5" y2="20" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  briefcase: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </>
  ),
  plane: (
    <>
      <path d="M21 3 3 10.5l7 2.5 2.5 7z" />
      <path d="M10 13 21 3" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  bars: (
    <>
      <line x1="6" y1="19" x2="6" y2="13" />
      <line x1="10.5" y1="19" x2="10.5" y2="9" />
      <line x1="15" y1="19" x2="15" y2="11" />
      <line x1="19.5" y1="19" x2="19.5" y2="5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.5" />
    </>
  ),
  left: <polyline points="15,5 8,12 15,19" />,
  right: <polyline points="9,5 16,12 9,19" />,
  back: (
    <>
      <line x1="20" y1="12" x2="5" y2="12" />
      <polyline points="11,6 5,12 11,18" />
    </>
  ),
  arrow: (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13,6 19,12 13,18" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
      <line x1="16" y1="9.5" x2="21" y2="14.5" />
      <line x1="21" y1="9.5" x2="16" y2="14.5" />
    </>
  ),
  voice: (
    <>
      <path d="M4 12h1.5M7.5 8v8M11 5v14M14.5 8.5v7M18 10.5v3M20.5 12H20" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="17.5" x2="12" y2="21" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </>
  ),
  signal: (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17l-1.8-5.4L4.5 10l5.7-1.4z" />,
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1.3-4-2-5.6-2.5M14.6 21v-3.3c0-1 .1-1.4-.5-2 2.6-.3 5.4-1.3 5.4-5.8A4.5 4.5 0 0 0 18.3 6.6a4.2 4.2 0 0 0-.1-3.1s-1-.3-3.3 1.3a11.3 11.3 0 0 0-6 0C6.6 3.2 5.6 3.5 5.6 3.5a4.2 4.2 0 0 0-.1 3.1A4.5 4.5 0 0 0 4.3 9.9c0 4.5 2.8 5.5 5.4 5.8-.6.6-.6 1.2-.5 2V21" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="8" y1="10.5" x2="8" y2="17" />
      <circle cx="8" cy="7.3" r=".6" />
      <path d="M12 17v-6.5M12 13a3 3 0 0 1 6 0v4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14,3 14,8 19,8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <polyline points="5,12.5 10,17 19,7" />,
  send: (
    <>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-7.5L3 9.5z" />
    </>
  ),
  home: (
    <>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-20 12 12)" />
    </>
  ),
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <polyline points="4,4 4,9 9,9" />
    </>
  ),
  question: <path d="M8.6 8.4a3.5 3.5 0 1 1 4.9 3.3c-.9.4-1.5 1.2-1.5 2.2v.6 M12 18.6v.2" />,
}

export function Icon({ name, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {ICONS[name]}
    </svg>
  )
}
