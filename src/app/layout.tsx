import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobiAdvisor - AI Phone Shopping Assistant",
  description: "Your intelligent shopping companion for finding the perfect mobile phone. Compare models, get recommendations, and make informed decisions.",
  keywords: ["phone", "shopping", "AI", "assistant", "compare", "mobile", "advisor"],
  authors: [{ name: "MobiAdvisor Team" }],
  openGraph: {
    title: "MobiAdvisor - AI Phone Shopping Assistant",
    description: "Your intelligent shopping companion for finding the perfect mobile phone.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
