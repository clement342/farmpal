import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { HowItWorks } from '@/components/landing/how-it-works';
import { OfflineAI } from '@/components/landing/offline-ai';
import { CTA } from '@/components/landing/cta';
import { Footer } from '@/components/landing/footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <OfflineAI />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
