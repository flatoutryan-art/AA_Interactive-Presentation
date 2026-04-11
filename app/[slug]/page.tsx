/**
 * app/[slug]/page.tsx
 *
 * SERVER component — no 'use client' here.
 * Next.js App Router requires the page entry in a dynamic route folder
 * to be a server component. It receives `params` from the router and
 * passes the slug string down to the interactive client component.
 */

import ProposalClient from './ProposalClient';

type Props = {
  params: { slug: string };
};

export default function ProposalPage({ params }: Props) {
  return <ProposalClient slug={params.slug} />;
}
