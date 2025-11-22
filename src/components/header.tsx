import Link from 'next/link';
import { AppLogo } from '@/components/icons';
import type { ReactNode } from 'react';

type AppHeaderProps = {
  websiteName?: string;
  children?: ReactNode;
}

export default function AppHeader({ websiteName, children }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <AppLogo className="h-6 w-6 text-primary" />
        <h1 className="font-headline text-lg">{websiteName || 'GenWebAI'}</h1>
      </Link>
      <div className="flex w-full items-center justify-end gap-2 md:ml-auto">
        {children}
      </div>
    </header>
  );
}
