import React from 'react';
import { IconShieldCheck, IconCertificate, IconHeartHandshake, IconTrendingUp } from '@tabler/icons-react';
import { motion } from 'motion/react';

const TrustSection = () => {
    const features = [
        {
            icon: IconShieldCheck,
            title: "Bank-Grade Security",
            description: "Your funds are protected with military-grade encryption and multi-signature wallets."
        },
        {
            icon: IconCertificate,
            title: "Smart Contract Verified",
            description: "All transactions are governed by audited smart contracts on the blockchain."
        },
        {
            icon: IconHeartHandshake,
            title: "Fair for Everyone",
            description: "Our dispute resolution system ensures fair outcomes for both parties."
        },
        {
            icon: IconTrendingUp,
            title: "Built for Scale",
            description: "From $10 gigs to $100K projects, our platform grows with your needs."
        }
    ];

    return (
        <section className="py-20 bg-background">
            <div className="container mx-auto px-6">
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                        Why Freelancers & Clients Choose Bondr
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                        Built on trust, powered by technology. We&apos;ve reimagined escrow for the modern workforce.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            className="group p-6 rounded-2xl bg-card border hover:shadow-xl transition-all duration-300"
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <feature.icon className="h-7 w-7 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Stats section */}
                <motion.div
                    className="mt-20 p-8 rounded-3xl bg-primary/5 border border-primary/10"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.3 }}
                            viewport={{ once: true }}
                        >
                            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">99.9%</div>
                            <div className="text-muted-foreground text-sm">Uptime</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.4 }}
                            viewport={{ once: true }}
                        >
                            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">24/7</div>
                            <div className="text-muted-foreground text-sm">Support</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.5 }}
                            viewport={{ once: true }}
                        >
                            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">0.5%</div>
                            <div className="text-muted-foreground text-sm">Platform Fee</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">2min</div>
                            <div className="text-muted-foreground text-sm">Setup Time</div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default TrustSection;