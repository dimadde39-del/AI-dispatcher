import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dispatcher Admin",
  description: "Internal admin for AI Dispatcher pilots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
