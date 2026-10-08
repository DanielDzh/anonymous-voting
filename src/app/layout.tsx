import type { Metadata, Viewport } from "next";
import {
  Comfortaa,
  Golos_Text,
  Inter,
  JetBrains_Mono,
  Nunito,
  Onest,
  Oswald,
  Pangolin,
  Rubik_Mono_One,
  Unbounded,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
});

// Theme fonts: only one theme is active at a time, so none of these are preloaded.
const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], weight: ["400", "600", "800"], preload: false });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"], weight: ["600", "800"], preload: false });
const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"], weight: ["400", "600"], preload: false });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "cyrillic"], weight: ["600", "800", "900"], preload: false });

const comfortaa = Comfortaa({ variable: "--font-comfortaa", subsets: ["latin", "cyrillic"], weight: ["500", "700"], preload: false });
const rubikMono = Rubik_Mono_One({ variable: "--font-rubik-mono", subsets: ["latin", "cyrillic"], weight: "400", preload: false });
const pangolin = Pangolin({ variable: "--font-pangolin", subsets: ["latin", "cyrillic"], weight: "400", preload: false });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin", "cyrillic"], weight: ["500", "700"], preload: false });

const fontVariables = [inter, jetbrains, onest, unbounded, golos, nunito, comfortaa, rubikMono, pangolin, oswald].map((font) => font.variable).join(" ");

export const metadata: Metadata = {
  title: "Анонімне голосування",
  description: "Анонімне голосування за кодом або QR",
};

export const viewport: Viewport = {
  themeColor: "#0f1013",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="uk" className={`${fontVariables} antialiased`}>
    <body>{children}</body>
  </html>
);

export default RootLayout;
