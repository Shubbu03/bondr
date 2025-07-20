"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../theme-toggle";

export function LandingHeader() {
    const [mounted, setMounted] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <header className="relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-4">
                        <div
                            className="relative cursor-pointer"
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            <div className={`w-10 h-10 bg-gradient-to-br from-eucalyptus to-eucalyptus/80 transform rotate-45 rounded-lg shadow-lg transition-transform duration-75 ${isHovered ? 'animate-spin' : ''}`}></div>
                            <div className={`absolute inset-0 w-10 h-10 bg-gradient-to-tl from-pistachio/40 to-transparent transform rotate-45 rounded-lg transition-transform duration-75 ${isHovered ? 'animate-spin' : ''}`}></div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-eucalyptus to-black-glaze dark:to-white bg-clip-text text-transparent">
                                Bondr
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">SOLANA REMITTANCE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <WalletMultiButton className="!bg-eucalyptus hover:!bg-eucalyptus/90" />
                    </div>
                </div>
            </div>
        </header>
    );
} 