"use client";

import { Zap, Shield, QrCode } from "lucide-react";

export function FeaturesSection() {
    const features = [
        {
            icon: Zap,
            title: "Lightning Fast",
            description: "Create and send remittances in seconds. No complexity. Just pure speed powered by Solana's lightning-fast blockchain.",
        },
        {
            icon: QrCode,
            title: "QR Magic",
            description: "Share payments through beautiful QR codes. Recipients scan, claim, and receive SOL instantly. No technical knowledge required.",
        },
        {
            icon: Shield,
            title: "Bank-Grade Security",
            description: "Built on Solana's proven infrastructure with enterprise-grade security. Your funds are protected by cutting-edge cryptographic protocols.",
        }
    ];

    return (
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-10 right-10 w-72 h-72 bg-eucalyptus/10 dark:bg-eucalyptus/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-20 w-96 h-96 bg-pistachio/15 dark:bg-pistachio/8 rounded-full blur-3xl"></div>
            </div>

            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-black-glaze dark:text-white mb-4">
                    Why Choose Bondr?
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                    Built for the future of decentralized finance
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className="group relative bg-white/70 dark:bg-black-glaze/70 backdrop-blur-sm p-8 rounded-3xl border border-white/30 dark:border-gray-700/30 hover:border-eucalyptus/30 dark:hover:border-eucalyptus/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                    >
                        <div className="w-16 h-16 bg-gradient-to-br from-eucalyptus/20 to-pistachio/20 dark:from-eucalyptus/30 dark:to-pistachio/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <feature.icon className="w-8 h-8 text-eucalyptus" />
                        </div>
                        <h3 className="text-2xl font-bold text-black-glaze dark:text-white mb-4">{feature.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
} 