import {useContactInformation} from '~/lib/contact-information';
import {useSocialLinks} from '~/lib/social-media';
import {ICONS, MailIcon, PhoneIcon, PinIcon} from '~/components/Icons';

/**
 * Shared renderers for the global "Contact Information" and "Social Media"
 * metaobjects (loaded once by the root loader). Used by the footer and the
 * Contact page; reuse them anywhere contact details or social links are
 * needed.
 *
 * `tone` adapts colors to the background: "dark" (e.g. the black footer) or
 * "light" (regular page backgrounds).
 */
const TONES = {
  dark: {
    iconWrap: 'border-white/20 text-white',
    text: 'text-white/70',
    link: 'text-white/70 hover:text-white',
    label: 'text-white/50',
    social:
      'border-white/20 text-white hover:border-white hover:bg-white hover:text-ink',
  },
  light: {
    iconWrap: 'border-line bg-white text-ink',
    text: 'text-ink',
    link: 'text-ink hover:text-accent',
    label: 'text-muted',
    social:
      'border-line bg-white text-ink hover:border-ink hover:bg-ink hover:text-white',
  },
};

/**
 * Email, phone and address rows; each row renders only when configured and
 * nothing renders when none are.
 * @param {{
 *   tone?: keyof typeof TONES;
 *   showLabels?: boolean;
 *   className?: string;
 * }}
 */
export function ContactDetailsList({
  tone = 'light',
  showLabels = false,
  className = '',
}) {
  const {email, phone, address} = useContactInformation();
  if (!email && !phone && !address) return null;
  const styles = TONES[tone];
  const linkClass = `inline-flex min-h-9 items-center break-all underline-offset-4 transition-colors duration-200 hover:underline ${styles.link}`;

  return (
    <address className={`not-italic ${className}`}>
      <ul className={showLabels ? 'space-y-6' : 'space-y-3 text-sm'}>
        {email ? (
          <ContactRow
            icon={MailIcon}
            label="Email"
            showLabel={showLabels}
            styles={styles}
          >
            <a href={email.href} className={linkClass}>
              {email.value}
            </a>
          </ContactRow>
        ) : null}
        {phone ? (
          <ContactRow
            icon={PhoneIcon}
            label="Phone"
            showLabel={showLabels}
            styles={styles}
          >
            <a href={phone.href} className={linkClass}>
              {phone.value}
            </a>
          </ContactRow>
        ) : null}
        {address ? (
          <ContactRow
            icon={PinIcon}
            label="Address"
            showLabel={showLabels}
            styles={styles}
          >
            <span
              className={`block leading-relaxed ${showLabels ? '' : 'py-2'} ${styles.text}`}
            >
              {address.lines.map((line, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={index} className="block">
                  {line}
                </span>
              ))}
            </span>
          </ContactRow>
        ) : null}
      </ul>
    </address>
  );
}

/**
 * @param {{
 *   icon: (props: {className?: string}) => React.ReactNode;
 *   label: string;
 *   showLabel: boolean;
 *   styles: (typeof TONES)[keyof typeof TONES];
 *   children: React.ReactNode;
 * }}
 */
function ContactRow({icon: Icon, label, showLabel, styles, children}) {
  return (
    <li className={`flex items-start ${showLabel ? 'gap-4' : 'gap-3'}`}>
      {/* Icons are aria-hidden; the label is announced once. */}
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border ${
          showLabel ? 'size-11' : 'mt-0.5 size-8'
        } ${styles.iconWrap}`}
      >
        <Icon className={showLabel ? 'size-5' : 'size-4'} />
      </span>
      <span className="min-w-0">
        {showLabel ? (
          <span
            className={`block text-xs font-semibold tracking-[0.15em] uppercase ${styles.label}`}
          >
            {label}
          </span>
        ) : (
          <span className="sr-only">{label}: </span>
        )}
        {children}
      </span>
    </li>
  );
}

/**
 * Configured social networks as icon links; nothing renders when none are.
 * @param {{
 *   tone?: keyof typeof TONES;
 *   className?: string;
 * }}
 */
export function SocialIconLinks({tone = 'light', className = ''}) {
  const socialLinks = useSocialLinks();
  if (!socialLinks.length) return null;
  const styles = TONES[tone];

  return (
    <ul
      className={`flex flex-wrap gap-2 ${className}`}
      aria-label="Social media"
    >
      {socialLinks.map(({network, label, href}) => {
        const Icon = ICONS[network];
        return (
          <li key={network}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className={`inline-flex size-10 items-center justify-center rounded-full border transition-colors duration-200 ${styles.social}`}
            >
              <Icon className="size-4.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** True when at least one social network is configured. */
export function useHasSocialLinks() {
  return useSocialLinks().length > 0;
}
