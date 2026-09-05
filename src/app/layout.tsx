import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [{ path: "./fonts/inter-400.woff2", weight: "400", style: "normal" }, { path: "./fonts/inter-500.woff2", weight: "500", style: "normal" }, { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" }, { path: "./fonts/inter-700.woff2", weight: "700", style: "normal" }, { path: "./fonts/inter-800.woff2", weight: "800", style: "normal" }, { path: "./fonts/inter-900.woff2", weight: "900", style: "normal" }],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KUET CSE Automation",
  description: "KUET CSE Department Automation Portal - Admin & Teacher Dashboard",
  keywords: ["KUET", "CSE", "Automation", "University", "Portal"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
