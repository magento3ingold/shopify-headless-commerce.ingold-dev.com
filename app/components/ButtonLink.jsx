import {Link} from 'react-router';
import {useLocalePath} from '~/lib/i18n';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold tracking-wide transition-colors duration-200 no-underline hover:no-underline';

export const BUTTON_VARIANTS = {
  primary: `${BASE} bg-ink text-white hover:bg-ink-soft`,
  light: `${BASE} bg-white text-ink hover:bg-surface`,
  outline: `${BASE} border border-ink text-ink hover:bg-ink hover:text-white`,
};

/**
 * Call-to-action styled link. Internal paths are localized for the active
 * market automatically.
 * @param {{
 *   to: string;
 *   variant?: keyof typeof BUTTON_VARIANTS;
 *   className?: string;
 *   children: React.ReactNode;
 * } & Omit<React.ComponentProps<typeof Link>, 'to'>}
 */
export function ButtonLink({
  to,
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  const localePath = useLocalePath();
  return (
    <Link
      prefetch="intent"
      {...props}
      to={localePath(to)}
      className={`${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
