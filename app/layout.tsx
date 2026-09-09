import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'GroupPilot｜AI 代理組長',
  description: '學生專案的自動分工、風險追蹤與貢獻分析。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
