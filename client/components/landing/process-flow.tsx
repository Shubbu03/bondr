import React from 'react';
import { IconUser, IconLock, IconCurrencyDollar, IconArrowRight, IconCheck } from '@tabler/icons-react';
import { motion } from 'motion/react';

const ProcessFlow = () => {
    const steps = [
        {
            icon: IconUser,
            title: "Client",
            description: "Posts project & deposits funds",
            color: "text-primary",
            bgColor: "bg-primary/10"
        },
        {
            icon: IconLock,
            title: "Escrow",
            description: "Funds secured until milestones met",
            color: "text-accent",
            bgColor: "bg-accent/10"
        },
        {
            icon: IconCurrencyDollar,
            title: "Freelancer",
            description: "Delivers work & receives payment",
            color: "text-primary",
            bgColor: "bg-primary/10"
        }
    ];

    return (
        <section className="py-20 bg-card/20">
            <div className="container mx-auto px-6">
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                        How Bondr Works
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Simple, secure, and transparent. Our three-step process ensures everyone gets what they deserve.
                    </p>
                </motion.div>

                <div className="relative max-w-5xl mx-auto">
                    {/* Flow visualization */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
                        {steps.map((step, index) => (
                            <React.Fragment key={index}>
                                {/* Step card */}
                                <motion.div
                                    className="flex flex-col items-center text-center group"
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.2 }}
                                    whileHover={{ y: -4 }}
                                    viewport={{ once: true }}
                                >
                                    {/* Icon circle */}
                                    <div className={`w-20 h-20 rounded-full ${step.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                        <step.icon className={`h-8 w-8 ${step.color}`} />
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-xl font-bold mb-2 text-foreground">{step.title}</h3>
                                    <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">{step.description}</p>
                                </motion.div>

                                {/* Arrow (not after last item) */}
                                {index < steps.length - 1 && (
                                    <motion.div
                                        className="hidden md:flex items-center"
                                        animate={{ x: [0, 4, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <div className="relative">
                                            {/* Solid line */}
                                            <div className="w-16 h-1 bg-primary rounded-full"></div>
                                            <IconArrowRight className="absolute -right-3 -top-3 h-5 w-5 text-accent" />
                                        </div>
                                    </motion.div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Mobile arrows */}
                    <div className="md:hidden flex flex-col items-center gap-4 mt-6">
                        {steps.slice(0, -1).map((_, index) => (
                            <IconArrowRight key={index} className="h-5 w-5 text-accent rotate-90" />
                        ))}
                    </div>
                </div>

                {/* Benefits section */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                >
                    {[
                        { icon: IconCheck, text: "Milestone-based releases" },
                        { icon: IconCheck, text: "Dispute resolution" },
                        { icon: IconCheck, text: "Transparent tracking" },
                        { icon: IconCheck, text: "Automatic payments" }
                    ].map((benefit, index) => (
                        <motion.div
                            key={index}
                            className="flex items-center gap-3 p-4 rounded-lg bg-card border hover:shadow-md transition-shadow"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <benefit.icon className="h-4 w-4 text-success flex-shrink-0" />
                            <span className="text-foreground font-medium text-sm">{benefit.text}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default ProcessFlow;