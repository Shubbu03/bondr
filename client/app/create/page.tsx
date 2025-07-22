"use client";

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { RemittanceForm } from '@/components/remittance-form';
import { QRDisplay } from '@/components/qr-display';
import { Feedback } from '@/components/feedback';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarInfo } from '@/components/sidebar-info';
import { RemittanceFormData, RemittanceState } from '@/types/remittance';
import { createRemittance } from '@/lib/remittance';
import { notify } from '@/lib/notify';

export default function CreatePage() {
    const wallet = useWallet();
    const { connected, publicKey } = wallet;
    const [remittanceState, setRemittanceState] = useState<RemittanceState>({
        status: 'idle',
    });

    const handleCreateRemittance = async (formData: RemittanceFormData) => {
        if (!connected || !publicKey) {
            notify('Please connect your wallet first', 'error');
            return;
        }

        setRemittanceState({ status: 'creating' });

        try {
            const result = await createRemittance({
                amount: formData.amount,
                receiverWallet: formData.receiverWallet || undefined,
                senderWallet: wallet,
            });

            const remittanceData = {
                amount: parseFloat(formData.amount),
                receiverWallet: formData.receiverWallet || undefined,
                senderWallet: publicKey.toString(),
                refSeed: result.refSeed.toString(),
                pda: result.pda,
                txSignature: result.txSignature,
            };

            setRemittanceState({
                status: 'success',
                data: remittanceData,
                qrUrl: result.qrUrl,
            });

            notify('Remittance created successfully!', 'success');
        } catch (error) {
            console.error('Failed to create remittance:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            setRemittanceState({
                status: 'error',
                error: errorMessage,
            });

            notify(errorMessage, 'error');
        }
    };

    const handleRetry = () => {
        setRemittanceState({ status: 'idle' });
    };

    const handleCreateAnother = () => {
        setRemittanceState({ status: 'idle' });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black-glaze transition-colors">
            <header className="bg-white dark:bg-black-glaze/90 shadow-sm border-b border-gray-200 dark:border-gray-700/30 backdrop-blur-sm relative z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/"
                                className="p-2 text-gray-400 dark:text-gray-500 hover:text-eucalyptus dark:hover:text-eucalyptus transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-black-glaze dark:text-white">Bondr</h1>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Create Remittance</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <WalletMultiButton />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    <Feedback
                        status={remittanceState.status}
                        error={remittanceState.error}
                        onRetry={handleRetry}
                    />

                    {remittanceState.status === 'success' && remittanceState.data && remittanceState.qrUrl ? (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <QRDisplay
                                remittanceData={remittanceState.data}
                                qrUrl={remittanceState.qrUrl}
                            />

                            <div className="text-center">
                                <button
                                    onClick={handleCreateAnother}
                                    className="px-6 py-3 bg-pistachio hover:bg-pistachio/90 dark:bg-pistachio dark:hover:bg-pistachio/80 text-black-glaze dark:text-black-glaze font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
                                >
                                    Create Another Remittance
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <RemittanceForm
                                    onSubmit={handleCreateRemittance}
                                    isLoading={remittanceState.status === 'creating'}
                                />
                            </div>

                            <SidebarInfo status={remittanceState.status} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
} 