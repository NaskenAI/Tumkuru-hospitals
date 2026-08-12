import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tumakuru Preview Pipeline",
  description: "Nasken AI pilot workspace for hospital preview generation.",
};

// Props are typed explicitly rather than relying on the Next.js-generated
// `LayoutProps` global, which only exists after `next build`/`next dev` has
// generated `.next/types`. Typing them here keeps `tsc --noEmit` green on a
// clean checkout.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
