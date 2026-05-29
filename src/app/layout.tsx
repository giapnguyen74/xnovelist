import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "xnovelist — AI-Free Basic Novel Editor",
  description: "A local-first, distraction-free writing studio for novelists.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
