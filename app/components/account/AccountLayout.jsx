import {AccountSidebar} from '~/components/account/AccountSidebar';

/**
 * Shared "My Account" frame: greeting, sidebar navigation and the page
 * content. Used by the account layout route for every account page.
 * @param {{
 *   customer: {firstName?: string | null; displayName?: string | null};
 *   children: React.ReactNode;
 * }}
 */
export function AccountLayout({customer, children}) {
  const name = customer?.firstName || customer?.displayName;

  return (
    <div className="account-page page-full-bleed ui-scope">
      <div className="page-width py-10 md:py-14">
        <header className="mb-8 md:mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
            My Account
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-medium text-ink md:text-4xl">
            {name ? `Welcome, ${name}` : 'Welcome to your account'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Manage your orders, addresses and account information.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <AccountSidebar />
          </div>
          <div id="account-content" className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Page heading + optional action used at the top of each account page.
 * @param {{title: string; description?: string; action?: React.ReactNode}}
 */
export function AccountPageHeader({title, description, action}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h2 className="text-xl font-semibold text-ink md:text-2xl">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   message: string;
 *   action?: React.ReactNode;
 * }}
 */
export function AccountEmptyState({title, message, action}) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-14 text-center">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Shared button styles for account pages. */
export const ACCOUNT_BUTTON = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white no-underline transition-colors duration-200 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink no-underline transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60',
  danger:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sale px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sale disabled:cursor-wait disabled:opacity-60',
  small:
    'inline-flex min-h-9 items-center justify-center rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink no-underline transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60',
};
