import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { IconMoon, IconSun, IconWallet } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion } from 'motion/react';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
                ? 'mx-4 mt-4 rounded-full bg-card/90 dark:bg-card/90 backdrop-blur-md border dark:border-border shadow-xl'
                : 'mx-0 mt-0 rounded-none bg-background/90 dark:bg-background/90 backdrop-blur-md border-b dark:border-border'
                }`}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="container mx-auto px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center">
                        <h1 className="text-2xl font-bold text-primary dark:text-primary">Bondr</h1>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-4">
                        {/* Theme Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="rounded-full"
                        >
                            {theme === 'dark' ? (
                                <IconSun className="h-5 w-5" />
                            ) : (
                                <IconMoon className="h-5 w-5" />
                            )}
                        </Button>

                        {/* Wallet Connect */}
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Button variant="outline" className="rounded-full">
                                <IconWallet className="h-4 w-4" />
                                Connect Wallet
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.nav>
    );
};

export default Navbar;