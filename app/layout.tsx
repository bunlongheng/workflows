import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automations",
  description: "Build powerful automations with a drag-and-drop visual flow builder",
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
