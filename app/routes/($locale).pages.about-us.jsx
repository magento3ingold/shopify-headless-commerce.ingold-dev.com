import {ButtonLink} from '~/components/ButtonLink';
import {BrandStory} from '~/components/BrandStory';
import {ABOUT_PAGE} from '~/lib/storefront-content';

/**
 * Designed "About Us" page.
 *
 * This static route takes precedence over the generic
 * `($locale).pages.$handle.jsx` route for the `about-us` handle only; every
 * other Shopify Page keeps rendering through the generic route. Content lives
 * in ABOUT_PAGE (~/lib/storefront-content). A Shopify Page with the handle
 * `about-us` will not be shown while this route exists.
 * @type {Route.MetaFunction}
 */
export const meta = ({matches}) => {
  const root = matches.find((match) => match?.id === 'root');
  const shopName = (root?.loaderData ?? root?.data)?.header?.shop?.name;
  return [
    {title: shopName ? `About Us | ${shopName}` : 'About Us'},
    {name: 'description', content: ABOUT_PAGE.hero.description},
  ];
};

export default function AboutUsPage() {
  const {hero, intro, story, mission, values} = ABOUT_PAGE;

  return (
    <div className="page-full-bleed ui-scope">
      <section aria-labelledby="about-heading" className="bg-surface">
        <div className="page-width py-20 text-center md:py-28">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {hero.eyebrow}
          </p>
          <h1
            id="about-heading"
            className="mx-auto max-w-3xl font-display text-4xl leading-[1.1] font-medium text-ink md:text-6xl"
          >
            {hero.heading}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            {hero.description}
          </p>
        </div>
      </section>

      <section aria-label="Introduction" className="page-width py-16 md:py-24">
        <p className="mx-auto max-w-4xl text-center font-display text-2xl leading-snug text-ink md:text-3xl">
          {intro}
        </p>
      </section>

      <section aria-label={story.heading} className="page-width pb-16 md:pb-24">
        <BrandStory
          heading={story.heading}
          body={story.body}
          image={story.image}
        />
      </section>

      <section aria-labelledby="mission-heading" className="bg-ink text-white">
        <div className="page-width grid gap-6 py-16 md:grid-cols-[1fr_2fr] md:gap-16 md:py-24">
          <h2
            id="mission-heading"
            className="font-display text-3xl font-medium text-white md:text-4xl"
          >
            {mission.heading}
          </h2>
          <p className="text-lg leading-relaxed text-white/80 md:text-2xl md:leading-relaxed">
            {mission.body}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="values-heading"
        className="page-width py-16 md:py-24"
      >
        <h2
          id="values-heading"
          className="mb-10 font-display text-3xl font-medium text-ink md:mb-12 md:text-4xl"
        >
          Our Values
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {values.map((value, index) => (
            <li
              key={value.title}
              className="rounded-card border border-line p-6 md:p-8"
            >
              <span
                aria-hidden="true"
                className="font-display text-3xl text-accent"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">
                {value.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {value.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="about-cta-heading" className="bg-surface">
        <div className="page-width flex flex-col items-center py-16 text-center md:py-24">
          <h2
            id="about-cta-heading"
            className="font-display text-3xl font-medium text-ink md:text-4xl"
          >
            Find your next favourite piece
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Explore the full collection and discover pieces designed to be part
            of your everyday.
          </p>
          <ButtonLink to="/collections/all" className="mt-8">
            Shop the collection
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

/** @typedef {import('./+types/pages.about-us').Route} Route */
