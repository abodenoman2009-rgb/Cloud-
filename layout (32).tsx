import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = IBM_Plex_Sans_Arabic({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-plex",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cloud Hard Drive — قرصك الصلب السحابي",
  description:
    "مساحة تخزين سحابية خاصة: ارفع الصور والفيديو والملفات، أفرغ مساحة هاتفك بأمان، وافتح ملفاتك من أي جهاز.",
  applicationName: "Cloud Hard Drive",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1012" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const bootScript = `
(function(){try{
  var t=localStorage.getItem("chd_theme");
  if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
  document.documentElement.dataset.theme=t;
  var l=localStorage.getItem("chd_lang")||"ar";
  document.documentElement.lang=l;
  document.documentElement.dir=l==="ar"?"rtl":"ltr";
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
