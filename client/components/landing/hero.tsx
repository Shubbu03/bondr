import React from 'react';
import { Button } from '@/components/ui/button';
import { IconArrowRight, IconShield, IconUsers, IconTrendingUp } from '@tabler/icons-react';
import { motion } from 'motion/react';

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
            {/* Subtle background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/2"></div>

            {/* Floating shapes - more subtle */}
            <div className="absolute top-32 left-10 w-12 h-12 bg-primary/5 rounded-full animate-float"></div>
            <div className="absolute top-48 right-16 w-8 h-8 bg-accent/5 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-32 left-16 w-6 h-6 bg-primary/3 rounded-full animate-float" style={{ animationDelay: '4s' }}></div>

            <div className="container mx-auto px-6 py-16 text-center relative z-10">
                <div className="max-w-4xl mx-auto">
                    {/* Main headline */}
                    <motion.h1
                        className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="text-foreground">Trustless Payments.</span>
                        <br />
                        <span className="text-primary">Seamless Freelancing.</span>
                    </motion.h1>

                    {/* Subheading */}
                    <motion.p
                        className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        The milestone-based escrow platform that protects both freelancers and clients.
                        Work with confidence, get paid securely.
                    </motion.p>

                    {/* CTA Button */}
                    <motion.div
                        className="mb-20"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="hero" size="lg" className="text-base px-10 py-4 font-semibold">
                                Get Started
                                <IconArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Stats/Trust indicators */}
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        <motion.div
                            className="flex flex-col items-center p-8 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50"
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.2 }}
                        >
                            <IconShield className="h-7 w-7 text-primary mb-3" />
                            <h3 className="text-lg font-semibold text-foreground">Secure Escrow</h3>
                            <p className="text-muted-foreground text-sm">Funds protected until milestones are met</p>
                        </motion.div>

                        <motion.div
                            className="flex flex-col items-center p-8 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50"
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.2 }}
                        >
                            <IconUsers className="h-7 w-7 text-success mb-3" />
                            <h3 className="text-lg font-semibold text-foreground">Trusted by 10K+</h3>
                            <p className="text-muted-foreground text-sm">Freelancers and clients worldwide</p>
                        </motion.div>

                        <motion.div
                            className="flex flex-col items-center p-8 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50"
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.2 }}
                        >
                            <IconTrendingUp className="h-7 w-7 text-accent mb-3" />
                            <h3 className="text-lg font-semibold text-foreground">$50M+ Secured</h3>
                            <p className="text-muted-foreground text-sm">In transactions processed safely</p>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default Hero;