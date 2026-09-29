import {Link} from 'react-router';
import {useLocalePath} from '~/lib/i18n';
import {ArrowRightIcon} from '~/components/Icons';

/**
 * Consistent heading block for storefront sections.
 * @param {{
 *   id?: string;
 *   eyebrow?: string;
 *   title: string;
 *   description?: string;
 *   action?: {label: string; to: string};
 *   align?: 'left' | 'center';
 * }}
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  align = 'left',
}) {
  const localePath = useLocalePath();
  const centered = align === 'center';

  return (
    <div
      className={`mb-8 flex flex-col gap-4 md:mb-10 ${
        centered
          ? 'items-center text-center'
          : 'md:flex-row md:items-end md:justify-between'
      }`}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className="font-display text-3xl leading-tight font-medium text-ink md:text-4xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-base leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <Link
          to={localePath(action.to)}
          prefetch="intent"
          className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
