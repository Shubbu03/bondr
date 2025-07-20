"use client";
import { LandingHeader, HeroSection, FeaturesSection, Footer } from "@/components/landing";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-pistachio/10 dark:from-black-glaze dark:via-gray-900 dark:to-black-glaze transition-colors">
      <LandingHeader />

      <main className="relative">
        <HeroSection />
        <FeaturesSection />
        <Footer />
      </main>
    </div>
  );
}
