import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {Link, useLocation, useNavigate, useNavigation} from 'react-router';
import {Aside, useAside} from '~/components/Aside';
import {ChevronDownIcon} from '~/components/Icons';
import {PriceRangeSlider} from '~/components/PriceRangeSlider';
import {
  FILTER_PARAM,
  MAX_PRICE_PARAM,
  MIN_PRICE_PARAM,
  SALE_PARAM,
  SORT_PARAM,
  clampPrice,
  clearFilters,
  clearPriceRange,
  filterKey,
  getPriceBounds,
  getPriceRange,
  getSelectedFilterInputs,
  getSortOption,
  getSortOptions,
  isSaleSelected,
  parseFilterInput,
  setPriceRange,
  setSort,
  toSearch,
  toggleFilter,
  toggleSale,
  validatePriceInput,
} from '~/lib/product-filters';

/** Product grid next to the filter sidebar (one column fewer than the full-width grid). */
export const FILTERED_PRODUCT_GRID_CLASSES =
  'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6';

/** Groups opened initially (plus every group with a selected value). */
const INITIALLY_OPEN_GROUPS = 3;
/** Values shown per group before "Show more". */
const VISIBLE_VALUES = 8;

/**
 * Filterable, sortable product listing shell: toolbar (mobile filter
 * button, active filter chips, sort), desktop sidebar and mobile drawer.
 * Filter groups and values come from Shopify only. No product total is
 * shown: the Storefront API returns none for collections, and the search
 * `totalCount` includes products the storefront cannot list.
 * @param {{
 *   filters: ShopifyFilter[];
 *   listing: 'collection' | 'search';
 *   priceBounds?: {min: number; max: number} | null;
 *   currency: {isoCode: string; symbol: string};
 *   locale: string;
 *   children: React.ReactNode;
 * }}
 */
export function ProductFilters({
  filters,
  listing,
  priceBounds = null,
  currency,
  locale,
  children,
}) {
  const state = useFilterState();
  const {searchParams} = state;
  const navigation = useNavigation();
  const isUpdating =
    navigation.state === 'loading' &&
    navigation.location?.pathname === state.location.pathname;

  const chips = useActiveFilterChips(filters, searchParams, currency, locale);
  const hasFilters = filters.length > 0;
  const formProps = {filters, priceBounds, currency, locale, state};

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)]">
      {hasFilters ? (
        <section aria-label="Product filters" className="hidden lg:block">
          <FilterForm {...formProps} idPrefix="desktop" />
        </section>
      ) : null}

      <div className={hasFilters ? '' : 'lg:col-span-2'}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            {hasFilters ? <MobileFilterButton count={chips.length} /> : null}
          </div>
          <SortSelect listing={listing} state={state} />
        </div>

        {chips.length ? (
          <ActiveFilterChips chips={chips} searchParams={searchParams} />
        ) : null}

        <div
          aria-busy={isUpdating}
          className={`transition-opacity duration-200 ${
            isUpdating ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {children}
        </div>
      </div>

      {hasFilters ? (
        <FilterDrawer
          formProps={formProps}
          listing={listing}
          chipCount={chips.length}
          isUpdating={isUpdating}
        />
      ) : null}
    </div>
  );
}

/**
 * Empty result message. With active filters it offers to clear them.
 * @param {{hasFilters: boolean; emptyMessage?: string}}
 */
export function FilteredEmptyState({hasFilters, emptyMessage}) {
  const {location, searchParams} = useFilterState();
  return (
    <div className="rounded-card border border-line px-6 py-16 text-center">
      <p className="text-base text-ink">
        {hasFilters
          ? 'No products match your selected filters.'
          : (emptyMessage ?? 'There are no products here yet.')}
      </p>
      {hasFilters ? (
        <Link
          to={`${location.pathname}${toSearch(clearFilters(searchParams))}`}
          preventScrollReset
          className="mt-6 inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white no-underline transition-colors duration-200 hover:bg-ink-soft"
        >
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Shown when the "On sale" check examined only part of the matching
 * products (see ~/lib/sale.server).
 */
export function SaleLimitNotice() {
  return (
    <p className="mt-10 text-center text-sm text-muted">
      Sale items are picked from the first matching products only. Add filters
      to narrow the results and see every discounted product.
    </p>
  );
}

/* ------------------------------ URL state ------------------------------ */

/**
 * The URL being shown, or the one being navigated to, so controls reflect
 * a change immediately while Shopify results load.
 */
function useFilterState() {
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const pending =
    navigation.location?.pathname === location.pathname
      ? navigation.location
      : null;
  const search = (pending ?? location).search;
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  /** @param {URLSearchParams} next */
  const go = (next) =>
    navigate(`${location.pathname}${toSearch(next)}`, {
      preventScrollReset: true,
    });

  return {location, searchParams, go};
}

/* ------------------------------ Filter form ----------------------------- */

/**
 * A native GET form so filtering also works without JavaScript; with
 * JavaScript every change is applied immediately.
 * @param {FormProps & {idPrefix: string}}
 */
function FilterForm({filters, priceBounds, currency, locale, state, idPrefix}) {
  const {location, searchParams} = state;
  const selectedKeys = useMemo(
    () =>
      new Set(getSelectedFilterInputs(searchParams).map((entry) => entry.key)),
    [searchParams],
  );
  const sort = searchParams.get(SORT_PARAM);

  return (
    <form
      method="get"
      action={location.pathname}
      onSubmit={(event) => {
        // JS path: checkboxes apply on change and price has its own submit.
        event.preventDefault();
      }}
    >
      {sort ? <input type="hidden" name={SORT_PARAM} value={sort} /> : null}
      <div className="divide-y divide-line border-y border-line">
        <SaleToggle state={state} />
        {filters.map((filter, index) => (
          <FilterGroup
            key={filter.id}
            filter={filter}
            priceBounds={priceBounds}
            currency={currency}
            locale={locale}
            state={state}
            selectedKeys={selectedKeys}
            idPrefix={idPrefix}
            defaultOpen={index < INITIALLY_OPEN_GROUPS}
          />
        ))}
      </div>
      <noscript>
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
        >
          Apply filters
        </button>
      </noscript>
    </form>
  );
}

/**
 * @param {{
 *   filter: ShopifyFilter;
 *   priceBounds: {min: number; max: number} | null;
 *   currency: {isoCode: string; symbol: string};
 *   locale: string;
 *   state: ReturnType<typeof useFilterState>;
 *   selectedKeys: Set<string>;
 *   idPrefix: string;
 *   defaultOpen: boolean;
 * }}
 */
function FilterGroup({
  filter,
  priceBounds,
  currency,
  locale,
  state,
  selectedKeys,
  idPrefix,
  defaultOpen,
}) {
  const isPrice = filter.type === 'PRICE_RANGE';
  const values = useMemo(
    () =>
      filter.values.map((value) => ({
        ...value,
        parsed: parseFilterInput(value.input),
      })),
    [filter.values],
  );
  const selectedCount = isPrice
    ? getPriceRange(state.searchParams)
      ? 1
      : 0
    : values.filter(
        (value) => value.parsed && selectedKeys.has(filterKey(value.parsed)),
      ).length;

  const [open, setOpen] = useState(defaultOpen || selectedCount > 0);
  const [showAll, setShowAll] = useState(false);
  const panelId = `${useId()}-${idPrefix}`;

  const visible =
    showAll || values.length <= VISIBLE_VALUES + 2
      ? values
      : values.slice(0, VISIBLE_VALUES);
  const isVisual =
    (filter.presentation === 'SWATCH' || filter.presentation === 'IMAGE') &&
    values.some((value) => swatchStyle(value));

  return (
    <fieldset className="m-0 block border-0 p-0">
      <legend className="float-left m-0 w-full p-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-semibold text-ink"
        >
          <span>
            {filter.label}
            {selectedCount ? (
              <span className="ml-2 text-xs font-normal text-muted">
                ({selectedCount} selected)
              </span>
            ) : null}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-4 shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </legend>
      <div id={panelId} hidden={!open} className="clear-both pb-5">
        {isPrice ? (
          <PriceRangeFilter
            bounds={priceBounds ?? getPriceBounds([filter])}
            currency={currency}
            locale={locale}
            state={state}
            idPrefix={panelId}
          />
        ) : (
          <>
            <ul
              className={
                isVisual ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2.5'
              }
            >
              {visible.map((value) => (
                <li key={value.id}>
                  <FilterValueOption
                    value={value}
                    isVisual={isVisual}
                    checked={Boolean(
                      value.parsed && selectedKeys.has(filterKey(value.parsed)),
                    )}
                    onToggle={() =>
                      state.go(toggleFilter(state.searchParams, value.input))
                    }
                  />
                </li>
              ))}
            </ul>
            {visible.length < values.length || showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mt-3 text-sm font-medium text-ink underline underline-offset-4"
              >
                {showAll
                  ? 'Show less'
                  : `Show ${values.length - visible.length} more`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </fieldset>
  );
}

/**
 * One Shopify filter value as a checkbox. Values that currently match no
 * products are disabled unless already selected.
 * @param {{
 *   value: ShopifyFilterValue & {parsed: object | null};
 *   isVisual: boolean;
 *   checked: boolean;
 *   onToggle: () => void;
 * }}
 */
function FilterValueOption({value, isVisual, checked, onToggle}) {
  const disabled = !value.parsed || (value.count === 0 && !checked);
  const input = (
    <input
      type="checkbox"
      name={FILTER_PARAM}
      value={value.input}
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      className={
        isVisual
          ? 'peer sr-only'
          : 'm-0 size-4 shrink-0 cursor-pointer rounded-sm border border-line p-0 accent-ink disabled:cursor-not-allowed'
      }
    />
  );
  const count = <span className="text-muted">({value.count})</span>;

  if (isVisual) {
    const style = swatchStyle(value);
    return (
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
          checked ? 'border-ink bg-surface' : 'border-line hover:border-ink'
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
      >
        {input}
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full border border-line bg-cover bg-center"
          style={style ?? undefined}
        />
        <span className="text-ink">{value.label}</span>
        {count}
      </label>
    );
  }

  return (
    <label
      className={`flex cursor-pointer items-center gap-3 text-sm text-ink ${
        disabled ? 'cursor-not-allowed opacity-40' : ''
      }`}
    >
      {input}
      <span className="flex-1">{value.label}</span>
      {count}
    </label>
  );
}

/** @param {ShopifyFilterValue} value */
function swatchStyle(value) {
  const imageUrl =
    value.swatch?.image?.image?.url ?? value.image?.image?.url ?? null;
  if (imageUrl) return {backgroundImage: `url("${encodeURI(imageUrl)}")`};
  if (value.swatch?.color) return {backgroundColor: value.swatch.color};
  return null;
}

/* ------------------------------ Sale toggle ----------------------------- */

/**
 * "On sale" is not a Shopify filter (the Storefront API cannot filter by
 * compare-at price); the server decides it, see ~/lib/sale.server.
 * @param {{state: ReturnType<typeof useFilterState>}}
 */
function SaleToggle({state}) {
  const checked = isSaleSelected(state.searchParams);
  return (
    <fieldset className="m-0 block border-0 px-0 py-4">
      <legend className="sr-only">Offers</legend>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name={SALE_PARAM}
          value="1"
          checked={checked}
          onChange={() => state.go(toggleSale(state.searchParams))}
          className="m-0 size-4 shrink-0 cursor-pointer rounded-sm border border-line p-0 accent-ink"
        />
        On sale
      </label>
    </fieldset>
  );
}

/* ------------------------------ Price range ----------------------------- */

/** Slider changes are applied once the shopper pauses. */
const SLIDER_APPLY_DELAY_MS = 450;

/**
 * Price range: a dual-handle slider plus numeric inputs, kept in sync.
 * The bounds are Shopify's reported price range; values are clamped into
 * it. A handle at its bound means "no limit" and leaves that URL param out.
 * @param {{
 *   bounds: {min: number; max: number} | null;
 *   currency: {isoCode: string; symbol: string};
 *   locale: string;
 *   state: ReturnType<typeof useFilterState>;
 *   idPrefix: string;
 * }}
 */
function PriceRangeFilter({bounds, currency, locale, state, idPrefix}) {
  const {searchParams} = state;
  const urlMin = searchParams.get(MIN_PRICE_PARAM) ?? '';
  const urlMax = searchParams.get(MAX_PRICE_PARAM) ?? '';
  const applied = getPriceRange(searchParams);
  const boundsMin = bounds?.min;
  const boundsMax = bounds?.max;

  /** Slider position for the values in the URL. */
  const fromUrl = () =>
    bounds
      ? {
          min: clampPrice(applied?.min ?? bounds.min, bounds),
          max: clampPrice(applied?.max ?? bounds.max, bounds),
        }
      : null;

  const [range, setRange] = useState(fromUrl);
  const [minText, setMinText] = useState(urlMin);
  const [maxText, setMaxText] = useState(urlMax);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const sliderDirty = useRef(false);

  // Restore from the URL (reload, back/forward, chips, clear all).
  useEffect(() => {
    sliderDirty.current = false;
    setRange(fromUrl());
    setMinText(urlMin);
    setMaxText(urlMax);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMin, urlMax, boundsMin, boundsMax]);

  const format = (amount) => formatMoney(amount, currency.isoCode, locale);
  const errorId = `${idPrefix}-price-error`;

  /** Applies a range; a value at its bound means "no limit". */
  const commit = (next) => {
    const min = bounds && next.min <= bounds.min ? '' : next.min;
    const max = bounds && next.max >= bounds.max ? '' : next.max;
    const target =
      min === '' && max === ''
        ? clearPriceRange(searchParams)
        : setPriceRange(searchParams, {min, max});
    if (toSearch(target) !== toSearch(searchParams)) state.go(target);
  };

  // Slider: apply after the shopper stops moving a handle.
  useEffect(() => {
    if (!sliderDirty.current || !range) return;
    const timer = setTimeout(() => {
      sliderDirty.current = false;
      commit(range);
    }, SLIDER_APPLY_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const onSlide = (next) => {
    sliderDirty.current = true;
    setError(null);
    setRange(next);
    setMinText(bounds && next.min <= bounds.min ? '' : String(next.min));
    setMaxText(bounds && next.max >= bounds.max ? '' : String(next.max));
  };

  /** Typing moves the handles live; the value is applied on Enter/blur. */
  const onType = (which, text) => {
    (which === 'min' ? setMinText : setMaxText)(text);
    const amount = Number(text);
    if (!bounds || !range || text.trim() === '' || !Number.isFinite(amount)) {
      return;
    }
    const clamped = clampPrice(amount, bounds);
    setRange(
      which === 'min'
        ? {min: Math.min(clamped, range.max), max: range.max}
        : {min: range.min, max: Math.max(clamped, range.min)},
    );
  };

  const applyInputs = () => {
    const message = validatePriceInput(minText, maxText);
    setError(message);
    if (message) return;
    const min = minText.trim() === '' ? undefined : Number(minText);
    const max = maxText.trim() === '' ? undefined : Number(maxText);
    if (!bounds) {
      state.go(setPriceRange(searchParams, {min, max}));
      return;
    }
    const next = {
      min: clampPrice(min ?? bounds.min, bounds),
      max: clampPrice(max ?? bounds.max, bounds),
    };
    if (next.min > next.max) {
      setError('The minimum price cannot be higher than the maximum.');
      return;
    }
    sliderDirty.current = false;
    setRange(next);
    setMinText(next.min <= bounds.min ? '' : String(next.min));
    setMaxText(next.max >= bounds.max ? '' : String(next.max));
    commit(next);
  };

  return (
    <div>
      {range && bounds ? (
        <>
          <p className="mb-3 text-sm font-medium text-ink" aria-hidden="true">
            {format(range.min)} – {format(range.max)}
          </p>
          <PriceRangeSlider
            bounds={bounds}
            value={range}
            onChange={onSlide}
            formatValue={format}
          />
        </>
      ) : null}
      <div className="mt-4 flex items-end gap-2">
        <PriceInput
          id={`${idPrefix}-min`}
          label="Min"
          name={MIN_PRICE_PARAM}
          value={minText}
          onChange={(text) => onType('min', text)}
          onEnter={applyInputs}
          onBlur={() => {
            if (minText !== urlMin) applyInputs();
          }}
          symbol={currency.symbol}
          placeholder={String(boundsMin ?? 0)}
          invalid={Boolean(error)}
          errorId={errorId}
        />
        <span aria-hidden="true" className="pb-2.5 text-muted">
          –
        </span>
        <PriceInput
          id={`${idPrefix}-max`}
          label="Max"
          name={MAX_PRICE_PARAM}
          value={maxText}
          onChange={(text) => onType('max', text)}
          onEnter={applyInputs}
          onBlur={() => {
            if (maxText !== urlMax) applyInputs();
          }}
          symbol={currency.symbol}
          placeholder={boundsMax !== undefined ? String(boundsMax) : ''}
          invalid={Boolean(error)}
          errorId={errorId}
        />
      </div>
      <p className="mt-2 text-xs text-muted">Prices in {currency.isoCode}</p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-sale">
          {error}
        </p>
      ) : null}
      {applied ? (
        <button
          type="button"
          onClick={() => state.go(clearPriceRange(searchParams))}
          className="mt-3 text-sm font-medium text-ink underline underline-offset-4"
        >
          Reset price
        </button>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   id: string;
 *   label: string;
 *   name: string;
 *   value: string;
 *   onChange: (value: string) => void;
 *   onEnter: () => void;
 *   onBlur: () => void;
 *   symbol: string;
 *   placeholder: string;
 *   invalid: boolean;
 *   errorId: string;
 * }}
 */
function PriceInput({
  id,
  label,
  name,
  value,
  onChange,
  onEnter,
  onBlur,
  symbol,
  placeholder,
  invalid,
  errorId,
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={`flex items-center rounded-lg border bg-white px-3 focus-within:border-ink ${
          invalid ? 'border-sale' : 'border-line'
        }`}
      >
        <span aria-hidden="true" className="text-sm text-muted">
          {symbol}
        </span>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={(event) => {
            // Apply instead of submitting the surrounding filter form.
            if (event.key === 'Enter') {
              event.preventDefault();
              onEnter();
            }
          }}
          className="m-0 w-full min-w-0 border-0 bg-transparent py-2 pl-1.5 text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}

/* ------------------------------- Sort select ---------------------------- */

/**
 * @param {{
 *   listing: 'collection' | 'search';
 *   state: ReturnType<typeof useFilterState>;
 *   stacked?: boolean;
 * }}
 */
function SortSelect({listing, state, stacked = false}) {
  const {location, searchParams} = state;
  const current = getSortOption(searchParams, listing);
  const id = useId();

  return (
    <form
      method="get"
      action={location.pathname}
      className={stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'}
      onSubmit={(event) => event.preventDefault()}
    >
      {/* Keep filters when sorting without JavaScript. */}
      {[FILTER_PARAM, MIN_PRICE_PARAM, MAX_PRICE_PARAM, SALE_PARAM].flatMap(
        (name) =>
          searchParams
            .getAll(name)
            .map((value) => (
              <input
                key={`${name}:${value}`}
                type="hidden"
                name={name}
                value={value}
              />
            )),
      )}
      <label
        htmlFor={id}
        className={
          stacked ? 'text-sm font-semibold text-ink' : 'text-sm text-muted'
        }
      >
        Sort by
      </label>
      <div className={stacked ? 'relative w-full' : 'relative'}>
        <select
          id={id}
          name={SORT_PARAM}
          value={current.value}
          onChange={(event) =>
            state.go(setSort(searchParams, event.target.value, listing))
          }
          className={`m-0 cursor-pointer appearance-none rounded-full border border-line bg-white pr-9 pl-4 text-sm font-medium text-ink focus:border-ink ${
            stacked ? 'w-full py-2.5' : 'py-2'
          }`}
        >
          {getSortOptions(searchParams, listing).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink"
        />
      </div>
      <noscript>
        <button type="submit" className="text-sm font-semibold underline">
          Sort
        </button>
      </noscript>
    </form>
  );
}

/* ---------------------------- Active filters ---------------------------- */

/**
 * Labels for the selected filters, taken from Shopify's filter values.
 * @param {ShopifyFilter[]} filters
 * @param {URLSearchParams} searchParams
 * @param {{isoCode: string}} currency
 * @param {string} locale
 */
function useActiveFilterChips(filters, searchParams, currency, locale) {
  return useMemo(() => {
    const labels = new Map();
    for (const filter of filters) {
      for (const value of filter.values) {
        const parsed = parseFilterInput(value.input);
        if (parsed) {
          labels.set(filterKey(parsed), {
            group: filter.label,
            label: value.label,
          });
        }
      }
    }

    const chips = getSelectedFilterInputs(searchParams).map(
      ({key, raw, filter}) => {
        const known = labels.get(key);
        return {
          id: key,
          label: known
            ? `${known.group}: ${known.label}`
            : fallbackLabel(filter),
          remove: toggleFilter(searchParams, raw),
        };
      },
    );

    if (isSaleSelected(searchParams)) {
      chips.unshift({
        id: 'sale',
        label: 'On sale',
        remove: toggleSale(searchParams),
      });
    }

    const price = getPriceRange(searchParams);
    if (price) {
      const format = (amount) => formatMoney(amount, currency.isoCode, locale);
      chips.push({
        id: 'price',
        label:
          price.min !== undefined && price.max !== undefined
            ? `Price: ${format(price.min)} – ${format(price.max)}`
            : price.min !== undefined
              ? `Price: from ${format(price.min)}`
              : `Price: up to ${format(price.max)}`,
        remove: clearPriceRange(searchParams),
      });
    }
    return chips;
  }, [filters, searchParams, currency.isoCode, locale]);
}

/**
 * @param {{
 *   chips: Array<{id: string; label: string; remove: URLSearchParams}>;
 *   searchParams: URLSearchParams;
 * }}
 */
function ActiveFilterChips({chips, searchParams}) {
  const {pathname} = useLocation();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <h2 className="sr-only">Active filters</h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.id}>
            <Link
              to={`${pathname}${toSearch(chip.remove)}`}
              preventScrollReset
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink no-underline transition-colors duration-200 hover:border-ink"
            >
              {chip.label}
              <span aria-hidden="true" className="text-base leading-none">
                ×
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={`${pathname}${toSearch(clearFilters(searchParams))}`}
        preventScrollReset
        className="ml-1 text-sm font-medium text-ink underline underline-offset-4"
      >
        Clear all
      </Link>
    </div>
  );
}

/** @param {object} filter a validated ProductFilter */
function fallbackLabel(filter) {
  const [[key, value]] = Object.entries(filter);
  if (key === 'available') return value ? 'In stock' : 'Out of stock';
  if (typeof value === 'string') return value;
  return value.value ?? value.id ?? key;
}

/**
 * @param {number} amount
 * @param {string} currencyCode
 * @param {string} locale
 */
function formatMoney(amount, currencyCode, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currencyCode}`;
  }
}

/* ----------------------------- Mobile drawer ---------------------------- */

/** @param {{count: number}} */
function MobileFilterButton({count}) {
  const {type, open} = useAside();
  return (
    <button
      type="button"
      onClick={() => open('filters')}
      aria-haspopup="dialog"
      aria-expanded={type === 'filters'}
      className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink lg:hidden"
    >
      <FilterIcon />
      Filter
      {count ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-xs text-white">
          <span className="sr-only">(</span>
          {count}
          <span className="sr-only"> active)</span>
        </span>
      ) : null}
    </button>
  );
}

/**
 * @param {{
 *   formProps: FormProps;
 *   listing: 'collection' | 'search';
 *   chipCount: number;
 *   isUpdating: boolean;
 * }}
 */
function FilterDrawer({formProps, listing, chipCount, isUpdating}) {
  const {state} = formProps;
  const {close} = useAside();
  return (
    <Aside type="filters" heading="Filter">
      <div className="ui-scope flex h-[calc(100dvh-var(--header-height)-2rem)] flex-col">
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <div className="pb-5">
            <SortSelect listing={listing} state={state} stacked />
          </div>
          <FilterForm {...formProps} idPrefix="drawer" />
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          {chipCount ? (
            <Link
              to={`${state.location.pathname}${toSearch(
                clearFilters(state.searchParams),
              )}`}
              preventScrollReset
              className="flex-1 rounded-full border border-line px-4 py-3 text-center text-sm font-semibold text-ink no-underline hover:border-ink"
            >
              Clear all
            </Link>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink-soft"
          >
            {isUpdating ? 'Updating…' : 'View results'}
          </button>
        </div>
      </div>
    </Aside>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="size-4"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   count: number;
 *   input: string;
 *   swatch?: {color?: string | null; image?: {image?: {url: string} | null} | null} | null;
 *   image?: {image?: {url: string} | null} | null;
 * }} ShopifyFilterValue
 */
/**
 * @typedef {{
 *   filters: ShopifyFilter[];
 *   priceBounds: {min: number; max: number} | null;
 *   currency: {isoCode: string; symbol: string};
 *   locale: string;
 *   state: ReturnType<typeof useFilterState>;
 * }} FormProps
 */
/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   type: 'BOOLEAN' | 'LIST' | 'PRICE_RANGE';
 *   presentation?: 'IMAGE' | 'SWATCH' | 'TEXT' | null;
 *   values: ShopifyFilterValue[];
 * }} ShopifyFilter
 */
