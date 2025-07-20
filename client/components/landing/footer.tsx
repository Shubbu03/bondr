"use client";

export function Footer() {
    return (
        <footer className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="bg-gradient-to-r from-eucalyptus to-eucalyptus/90 dark:from-eucalyptus/90 dark:to-eucalyptus/80 rounded-3xl p-12 text-center text-white">
                <div className="flex flex-col items-center justify-center gap-4">
                    <h2 className="text-4xl font-bold transition-all duration-300 hover:font-black cursor-default">
                        Bondr
                    </h2>
                    <p className="text-eucalyptus/70 dark:text-white/70 text-lg transition-all duration-300 hover:font-bold cursor-default">
                        Solana Remittance Platform
                    </p>
                    <div className="mt-4 text-sm text-eucalyptus/50 dark:text-white/50 transition-all duration-300 hover:font-bold cursor-default">
                        {`© ${new Date().getFullYear()} Bondr. Built on Solana.`}
                    </div>
                </div>
            </div>
        </footer>
    );
} 