import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "図形マトリクス型 CAPTCHA - 高度セキュリティ認証",
  description: "法則性に基づいた3x3図形パズルによる、AI自動解析に強い次世代のセキュリティ認証コンポーネントです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
