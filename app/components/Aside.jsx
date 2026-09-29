import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {useId} from 'react';

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 * @param {{
 *   children?: React.ReactNode;
 *   type: AsideType;
 *   heading: React.ReactNode;
 * }}
 */
export function Aside({children, heading, type}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  const asideRef = useRef(null);

  // Move focus into the drawer when it opens and restore it when it closes.
  // An element marked with `data-autofocus` receives focus first.
  useEffect(() => {
    if (!expanded) return;
    const previouslyFocused = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const target =
        asideRef.current?.querySelector('[data-autofocus]') ??
        asideRef.current?.querySelector('button.close');
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (
        previouslyFocused instanceof HTMLElement &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [expanded]);

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded]);

  return (
    <div
      aria-modal
      className={`overlay z-50 ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button
        className="close-outside"
        onClick={close}
        tabIndex={-1}
        aria-hidden="true"
      />
      <aside ref={asideRef}>
        <header className="border-line px-5">
          <h3
            id={id}
            className="text-xs font-semibold tracking-[0.2em] text-ink uppercase"
          >
            {heading}
          </h3>
          <button
            className="close reset inline-flex size-9 items-center justify-center rounded-full text-2xl leading-none transition-colors duration-200 hover:bg-surface"
            onClick={close}
            aria-label="Close"
          >
            &times;
          </button>
        </header>
        <main>{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext(null);

Aside.Provider = function AsideProvider({children}) {
  const [type, setType] = useState('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}

/** @typedef {'search' | 'cart' | 'mobile' | 'closed'} AsideType */
/**
 * @typedef {{
 *   type: AsideType;
 *   open: (mode: AsideType) => void;
 *   close: () => void;
 * }} AsideContextValue
 */

/** @typedef {import('react').ReactNode} ReactNode */
