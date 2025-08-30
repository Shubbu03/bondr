import FinalCTA from "./final-cta";
import Hero from "./hero";
import Navbar from "./navbar";
import ProcessFlow from "./process-flow";
import TrustSection from "./trust-section";

export default function Landing() {
    return (
        <div className="min-h-screen">
            <Navbar />
            <Hero />
            <ProcessFlow />
            <TrustSection />
            <FinalCTA />
        </div>
    );
}