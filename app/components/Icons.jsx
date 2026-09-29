/**
 * Lightweight inline SVG icons (stroke-based, 24px grid).
 * Icons are decorative by default; give the surrounding control an
 * accessible name instead of labelling the SVG itself.
 */

/**
 * @param {IconProps & {children: React.ReactNode}}
 */
function IconBase({className = 'size-5', strokeWidth = 1.6, children}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** @param {IconProps} props */
export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function UserIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function BagIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 8h14l-1 13H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </IconBase>
  );
}

/**
 * Heart; pass `filled` for the active (wishlisted) state.
 * @param {IconProps & {filled?: boolean}} props
 */
export function HeartIcon({filled = false, ...props}) {
  return (
    <IconBase {...props}>
      <path
        d="M12 20.5s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.7-7.5 10.1-7.5 10.1Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function MenuIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function ChevronLeftIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function ChevronRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function ArrowRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function PauseIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 6v12M15 6v12" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function PlayIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function MailIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function PhoneIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function ClockIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function PinIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function InstagramIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function FacebookIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function YouTubeIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9.2 5 2.8-5 2.8V9.2Z" fill="currentColor" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function LinkedInIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7.5 10.5V17M7.5 7.5v.01M11.5 17v-6.5M11.5 13.2a2.7 2.7 0 0 1 5 0V17" />
    </IconBase>
  );
}

/** @param {IconProps} props */
export function XIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 4h4l11 16h-4L4.5 4Z" />
      <path d="M19.5 4 13.4 11M10.6 13 4.5 20" />
    </IconBase>
  );
}

/** Social network icons, keyed by the `network` of ~/lib/social-media. */
export const ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  linkedin: LinkedInIcon,
  twitter: XIcon,
};

/**
 * @typedef {{
 *   className?: string;
 *   strokeWidth?: number;
 * }} IconProps
 */
