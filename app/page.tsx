import { redirect } from 'next/navigation';

// Root route → redirect to admin
export default function RootPage() {
  redirect('/admin');
}
