import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {NavLink, useLocation} from 'react-router';
import {useAside} from '~/components/Aside';
import {ChevronDownIcon} from '~/components/Icons';
import {useLocalePath} from '~/lib/i18n';

// useLayoutEffect warns during SSR; it is only needed in the browser.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

const HOVER_CLOSE_DELAY_MS = 150;

const DESKTOP_LINK =
  'relative inline-flex items-center py-2 text-sm font-medium tracking-wide whitespace-nowrap transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-ink after:transition-transform after:duration-200';

/**
 * Navigation built from the Shopify `main-menu` (see ~/lib/navigation).
 * Top-level items with children open a dropdown on hover or with the toggle
 * button; three-level menus render the second level as column headings.
 * @param {{items: NavItem[]}}
 */
export function DesktopNavigation({items}) {
  if (!items.length) return null;

  return (
    <ul className="flex items-center gap-6 xl:gap-8">
      {items.map((item) =>
        item.items.length ? (
          <DesktopDropdown key={item.id} item={item} />
        ) : (
          <li key={item.id}>
            <MenuLink item={item} className={desktopLinkClass} />
          </li>
        ),
      )}
    </ul>
  );
}

/** @param {{isActive?: boolean; isPending?: boolean}} state */
function desktopLinkClass({isActive = false, isPending = false} = {}) {
  return `${DESKTOP_LINK} ${
    isActive
      ? 'text-ink after:scale-x-100'
      : 'text-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100'
  } ${isPending ? 'opacity-60' : ''}`;
}

/**
 * Disclosure-style dropdown: the parent stays a normal link (when it has one)
 * and a separate button with aria-expanded toggles the panel.
 * Escape closes it and returns focus to the toggle; focus leaving the item
 * or navigating closes it too.
 * @param {{item: NavItem}}
 */
function DesktopDropdown({item}) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const closeTimer = useRef(/** @type {number | undefined} */ (undefined));
  const itemRef = useRef(/** @type {HTMLLIElement | null} */ (null));
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelId = useId();
  const {pathname} = useLocation();
  const hasColumns = item.items.some((child) => child.items.length);

  const open = () => {
    window.clearTimeout(closeTimer.current);
    setIsOpen(true);
  };
  const close = () => {
    window.clearTimeout(closeTimer.current);
    setIsOpen(false);
  };

  // Close after navigating.
  useEffect(() => {
    window.clearTimeout(closeTimer.current);
    setIsOpen(false);
  }, [pathname]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Escape closes the open dropdown; focus returns to its toggle when focus
  // was inside the menu item (keyboard users), not when it was hovered.
  useEffect(() => {
    if (!isOpen) return;
    const abortController = new AbortController();
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        const focusWasInside = itemRef.current?.contains(
          document.activeElement,
        );
        window.clearTimeout(closeTimer.current);
        setIsOpen(false);
        if (focusWasInside) buttonRef.current?.focus();
      },
      {signal: abortController.signal},
    );
    return () => abortController.abort();
  }, [isOpen]);

  // Keep the panel inside the viewport for items near the right edge.
  useIsomorphicLayoutEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const {right} = panelRef.current.getBoundingClientRect();
    if (right > document.documentElement.clientWidth - 16) setAlignRight(true);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) setAlignRight(false);
  }, [isOpen]);

  return (
    <li
      ref={itemRef}
      className="relative"
      onMouseEnter={open}
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(close, HOVER_CLOSE_DELAY_MS);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div className="flex items-center gap-1">
        {item.href ? (
          <MenuLink item={item} className={desktopLinkClass} />
        ) : null}
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={item.href ? `${item.title} submenu` : undefined}
          onClick={() => (isOpen ? close() : open())}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              open();
              requestAnimationFrame(() =>
                panelRef.current?.querySelector('a')?.focus(),
              );
            }
          }}
          className={
            item.href
              ? 'inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-surface hover:text-ink'
              : `${desktopLinkClass()} gap-1`
          }
        >
          {item.href ? null : item.title}
          <ChevronDownIcon
            className={`size-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!isOpen}
        className={`absolute top-full z-50 pt-3 ${alignRight ? 'right-0' : 'left-0'}`}
      >
        <div
          className={`max-w-[calc(100vw-2rem)] rounded-card border border-line bg-white p-5 shadow-card ${
            hasColumns ? 'grid w-max grid-flow-col gap-10' : 'min-w-56'
          }`}
        >
          {hasColumns ? (
            item.items.map((child) => (
              <div key={child.id} className="min-w-40">
                <MenuLink
                  item={child}
                  className="block pb-2 text-sm font-semibold text-ink hover:underline"
                />
                {child.items.length ? (
                  <ul className="space-y-1">
                    {child.items.map((grandchild) => (
                      <li key={grandchild.id}>
                        <MenuLink
                          item={grandchild}
                          className={dropdownLinkClass}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          ) : (
            <ul className="space-y-1">
              {item.items.map((child) => (
                <li key={child.id}>
                  <MenuLink item={child} className={dropdownLinkClass} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/** @param {{isActive?: boolean}} state */
function dropdownLinkClass({isActive = false} = {}) {
  return `block rounded-md px-2 py-1.5 -mx-2 text-sm whitespace-nowrap transition-colors duration-200 hover:bg-surface hover:text-ink ${
    isActive ? 'font-semibold text-ink' : 'text-muted'
  }`;
}

/**
 * Vertical, collapsible navigation for the mobile menu drawer.
 * @param {{items: NavItem[]}}
 */
export function MobileNavigation({items}) {
  if (!items.length) return null;

  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item) => (
        <MobileNavItem key={item.id} item={item} depth={0} />
      ))}
    </ul>
  );
}

/**
 * @param {{item: NavItem; depth: number}}
 */
function MobileNavItem({item, depth}) {
  const [isOpen, setIsOpen] = useState(false);
  const {close} = useAside();
  const submenuId = useId();
  const hasChildren = item.items.length > 0;
  const isTopLevel = depth === 0;

  const linkClass = ({isActive = false} = {}) =>
    isTopLevel
      ? `block flex-1 py-4 font-display text-2xl text-ink ${isActive ? 'font-semibold' : ''}`
      : `block flex-1 py-2.5 text-base ${isActive ? 'font-semibold text-ink' : 'text-muted'}`;

  const toggle = (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={submenuId}
      aria-label={item.href ? `${item.title} submenu` : undefined}
      onClick={() => setIsOpen((value) => !value)}
      className={
        item.href
          ? 'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-surface'
          : `${linkClass()} flex items-center justify-between text-left`
      }
    >
      {item.href ? null : item.title}
      <ChevronDownIcon
        className={`size-5 shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  );

  return (
    <li>
      <div className="flex items-center gap-2">
        {item.href ? (
          <MenuLink item={item} className={linkClass} onClick={close} />
        ) : null}
        {hasChildren ? toggle : null}
      </div>
      {hasChildren ? (
        <ul
          id={submenuId}
          hidden={!isOpen}
          className={`border-l border-line pl-4 ${isTopLevel ? 'mb-4' : 'mb-2'}`}
        >
          {item.items.map((child) => (
            <MobileNavItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Renders a menu item as an internal NavLink (localized for the active
 * market), an external anchor, or plain text when it has no destination.
 * @param {{
 *   item: NavItem;
 *   className: (state: {isActive?: boolean; isPending?: boolean}) => string;
 *   onClick?: () => void;
 * }}
 */
export function MenuLink({item, className, onClick}) {
  const localePath = useLocalePath();

  if (!item.href) {
    return <span className={className({})}>{item.title}</span>;
  }

  if (item.isExternal) {
    return (
      <a
        href={item.href}
        className={className({})}
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {item.title}
      </a>
    );
  }

  return (
    <NavLink
      end
      prefetch="intent"
      to={localePath(item.href)}
      className={className}
      onClick={onClick}
    >
      {item.title}
    </NavLink>
  );
}

/** @typedef {import('~/lib/navigation').NavItem} NavItem */
