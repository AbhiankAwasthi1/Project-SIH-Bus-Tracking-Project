import type { ReactNode } from "react";

export type CardProps = {
  title?: ReactNode;
  /** Rendered as a <section> when a heading is present, otherwise a <div>. */
  children: ReactNode;
  headingLevel?: 2 | 3;
};

export function Card({ title, children, headingLevel = 2 }: CardProps) {
  if (!title) {
    return <div className="card">{children}</div>;
  }
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="card">
      <Heading className="card__title">{title}</Heading>
      {children}
    </section>
  );
}
