"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Zap, Shield, Users, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
    const { connected } = useWallet();

    return (
        <>
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-pistachio/20 dark:bg-pistachio/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-eucalyptus/10 dark:bg-eucalyptus/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-black-glaze/80 backdrop-blur-sm border border-eucalyptus/20 dark:border-eucalyptus/30 rounded-full px-4 py-2 mb-8 cursor-pointer transition-all duration-300 hover:border-eucalyptus/60 dark:hover:border-eucalyptus/70 hover:shadow-lg hover:shadow-eucalyptus/20 dark:hover:shadow-eucalyptus/10">
                        <Sparkles className="w-4 h-4 text-eucalyptus transition-colors hover:text-pistachio" />
                        <span className="text-sm font-medium text-eucalyptus transition-colors hover:text-pistachio">Next-Gen Crypto Remittance</span>
                    </div>

                    <h1 className="text-5xl sm:text-7xl font-black text-black-glaze dark:text-white mb-8 leading-tight">
                        Send SOL<br />
                        <span className="bg-gradient-to-r from-eucalyptus via-pistachio to-eucalyptus bg-clip-text text-transparent">
                            Without Limits
                        </span>
                    </h1>

                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
                        Revolutionary QR-based remittance system on Solana. Create, share, and claim payments
                        instantly without any technical barriers.
                    </p>

                    {connected ? (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link
                                href="/create"
                                className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-eucalyptus to-eucalyptus/90 hover:from-eucalyptus/90 hover:to-eucalyptus text-white font-bold px-10 py-5 rounded-2xl transition-all text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                            >
                                <Zap className="w-6 h-6 group-hover:animate-pulse" />
                                Create Remittance
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <Shield className="w-4 h-4" />
                                <span>Secured by Solana</span>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-lg mx-auto">
                            <div className="bg-white/60 dark:bg-black-glaze/60 backdrop-blur-lg p-10 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/20">
                                <div className="flex items-center justify-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-gradient-to-br from-eucalyptus to-pistachio rounded-xl flex items-center justify-center">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-black-glaze dark:text-white">Ready to Start?</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
                                    Connect your Solana wallet to begin creating instant remittances
                                </p>
                                <WalletMultiButton className="w-full !bg-gradient-to-r !from-eucalyptus !to-eucalyptus/90 !py-4 !text-lg !font-semibold" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
} 