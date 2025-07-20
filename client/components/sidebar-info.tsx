"use client";

import useSWR from 'swr';
import { Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
    Connection,
    PublicKey,
    clusterApiUrl,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";

interface SidebarInfoProps {
    status: 'idle' | 'creating' | 'success' | 'error';
}

const balanceFetcher = async (address: string): Promise<number> => {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
};

export const SidebarInfo: React.FC<SidebarInfoProps> = ({ status }) => {
    const { connected, publicKey } = useWallet();

    const {
        data: balance,
        error: balanceError,
        isLoading: isLoadingBalance
    } = useSWR(
        connected && publicKey ? `balance-${publicKey.toString()}` : null,
        () => balanceFetcher(publicKey!.toString()),
        {
            refreshInterval: 50000,
            fallbackData: 125.456,
            onError: (error: any) => {
                console.error('Failed to fetch balance:', error);
            },
            revalidateOnFocus: true,
            dedupingInterval: 10000,
        }
    );

    if (status !== 'idle') return null;

    return (
        <div className="lg:col-span-1">
            <div className="space-y-6">
                {connected && (
                    <div className="bg-gradient-to-br from-eucalyptus/10 to-pistachio/10 dark:from-eucalyptus/20 dark:to-pistachio/20 p-6 rounded-2xl border border-eucalyptus/20 dark:border-eucalyptus/30 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-eucalyptus/20 dark:bg-eucalyptus/30 rounded-lg">
                                <Wallet className="w-5 h-5 text-eucalyptus" />
                            </div>
                            <h3 className="text-lg font-semibold text-black-glaze dark:text-white">Your Balance</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-300">Available SOL</span>
                                <span className="text-2xl font-bold text-black-glaze dark:text-white">
                                    {isLoadingBalance ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-eucalyptus border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-lg">Loading...</span>
                                        </div>
                                    ) : (
                                        `◎${(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 })}`
                                    )}
                                    {balanceError && (
                                        <span className="text-xs text-yellow-600 dark:text-yellow-400 block">
                                            (Network error - using fallback)
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div className="pt-2 border-t border-eucalyptus/20 dark:border-eucalyptus/30">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Wallet</span>
                                    <span className="text-gray-600 dark:text-gray-300 font-mono">
                                        {publicKey?.toString().slice(0, 6)}...{publicKey?.toString().slice(-4)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-black-glaze/80 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/30 backdrop-blur-sm sticky top-8">
                    <h3 className="text-lg font-semibold text-black-glaze dark:text-white mb-3">How it works</h3>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <p>• Enter the amount you want to send</p>
                        <p>• Optionally specify a receiver wallet</p>
                        <p>• Bondr will create a secure remittance and generate a QR code</p>
                        <p>• Share the QR code with the recipient to claim the funds</p>
                    </div>
                </div>
            </div>
        </div>
    );
}; 