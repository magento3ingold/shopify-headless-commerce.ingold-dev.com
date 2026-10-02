import {Form, NavLink} from 'react-router';
import {useLocalePath} from '~/lib/i18n';
import {BagIcon, LogOutIcon, PinIcon, UserIcon} from '~/components/Icons';

const ACCOUNT_LINKS = [
  {to: '/account/orders', label: 'Orders', Icon: BagIcon},
  {to: '/account/addresses', label: 'Addresses', Icon: PinIcon},
  {to: '/account/profile', label: 'Profile', Icon: UserIcon},
];

/**
 * Account navigation. Desktop: a vertical sidebar. Mobile: a compact,
 * horizontally scrollable row (inside its own box, so the page never
 * overflows). Sign out posts to the existing logout action.
 */
export function AccountSidebar() {
  const localePath = useLocalePath();

  return (
    <nav aria-label="My account" className="min-w-0">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {ACCOUNT_LINKS.map(({to, label, Icon}) => (
          <li key={to} className="shrink-0">
            <NavLink
              to={localePath(to)}
              prefetch="intent"
              className={({isActive}) =>
                `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:rounded-lg ${
                  isActive
                    ? 'bg-ink text-white'
                    : 'border border-line text-ink hover:border-ink lg:border-transparent lg:hover:border-transparent lg:hover:bg-surface'
                }`
              }
            >
              <Icon className="size-4.5 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
          <Form method="POST" action={localePath('/account/logout')}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-full border border-line px-4 py-2.5 text-left text-sm font-medium text-muted transition-colors duration-200 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:rounded-lg lg:border-transparent lg:hover:border-transparent lg:hover:bg-surface"
            >
              <LogOutIcon className="size-4.5 shrink-0" />
              Sign out
            </button>
          </Form>
        </li>
      </ul>
    </nav>
  );
}
