export interface RemittanceData {
    amount: number;
    receiverWallet?: string;
    senderWallet: string;
    refSeed: string;
    pda: string;
    txSignature: string; // Add transaction signature for verification
}

export interface RemittanceFormData {
    amount: string;
    receiverWallet: string;
}

export type RemittanceStatus = 'idle' | 'creating' | 'success' | 'error';

export interface RemittanceState {
    status: RemittanceStatus;
    data?: RemittanceData;
    error?: string;
    qrUrl?: string;
} 