import React from 'react';
import { Button } from '@/components/ui/button';
import { IconArrowRight, IconStars } from '@tabler/icons-react';
import { motion } from 'motion/react';

const FinalCTA = () => {
    return (
        <section className="py-20 bg-primary/5 relative overflow-hidden border-t border-primary/10">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 left-10 w-24 h-24 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
            </div>

            <div className="container mx-auto px-6 text-center relative z-10">
                <div className="max-w-4xl mx-auto">
                    {/* Badge */}
                    <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        <IconStars className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium text-foreground">Join thousands of satisfied users</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h2
                        className="text-4xl md:text-6xl font-bold mb-6 text-foreground"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        viewport={{ once: true }}
                    >
                        Ready to Work with
                        <span className="text-primary"> Confidence</span>?
                    </motion.h2>

                    {/* Description */}
                    <motion.p
                        className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        viewport={{ once: true }}
                    >
                        Start your first project today. No setup fees, no hidden costs.
                        Just secure, seamless payments for your freelance work.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        viewport={{ once: true }}
                    >
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="hero" size="lg" className="text-base px-10 py-4 font-semibold">
                                Start Free Project
                                <IconArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </motion.div>

                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="secondary" size="lg" className="text-base px-10 py-4 font-semibold">
                                View Demo
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Trust indicators */}
                    <motion.div
                        className="flex flex-wrap items-center justify-center gap-6 mt-12 text-muted-foreground"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-success rounded-full"></div>
                            <span className="text-sm">No setup fees</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-success rounded-full"></div>
                            <span className="text-sm">Cancel anytime</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-success rounded-full"></div>
                            <span className="text-sm">24/7 support</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;