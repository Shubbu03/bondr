import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { getProgram, getConnection } from './anchor';
import { notify } from './notify';
import { CLAIM_BASE_URL } from './constants';
import type { Bondr } from '../../target/types/bondr';

export interface CreateRemittanceParams {
    amount: string; // SOL amount as string
    receiverWallet?: string; // Optional receiver wallet
    senderWallet: WalletContextState;
}

export interface RemittanceResult {
    pda: string;
    refSeed: number;
    qrUrl: string;
    txSignature: string;
}

function solToLamports(solAmount: string): BN {
    const amount = parseFloat(solAmount);

    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
    }

    return new BN(amount * LAMPORTS_PER_SOL);
}

function generateReferenceSeed(): number {
    return Math.floor(Math.random() * 100) + 1;
}

function derivePDA(
    program: Program<Bondr>,
    senderPubkey: PublicKey,
    receiverPubkey: PublicKey,
    referenceSeed: number
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from('remittance'),
            senderPubkey.toBuffer(),
            receiverPubkey.toBuffer(),
            Buffer.from([referenceSeed])
        ],
        program.programId
    );
}

function deriveStatsPDA(
    program: Program<Bondr>,
    senderPubkey: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from('remit_stats'),
            senderPubkey.toBuffer()
        ],
        program.programId
    );
}

function generateSolanaPayUrl(
    receiverPubkey: PublicKey | null,
    amount: string,
    referenceSeed: number,
    senderPubkey: PublicKey
): string {
    // Generate URL pointing to our claim page with all necessary data
    const baseUrl = CLAIM_BASE_URL;

    const url = new URL(baseUrl);
    url.searchParams.append('amount', amount);
    url.searchParams.append('reference', referenceSeed.toString()); // reference_seed for PDA derivation
    url.searchParams.append('sender', senderPubkey.toBase58()); // sender address

    // Only add receiver if it's different from sender (targeted remittance)
    if (receiverPubkey && !receiverPubkey.equals(senderPubkey)) {
        url.searchParams.append('receiver', receiverPubkey.toBase58());
    }

    return url.toString();
}

function validateSolanaAddress(address: string): PublicKey {
    try {
        return new PublicKey(address);
    } catch {
        throw new Error('Invalid Solana address format');
    }
}

export interface ClaimRemittanceParams {
    amount: string;
    referenceSeed: number;
    senderPubkey: string;
    receiverWallet: WalletContextState;
}

export interface ClaimResult {
    txSignature: string;
    amountClaimed: number;
}

export async function claimRemittance(params: ClaimRemittanceParams): Promise<ClaimResult> {
    const { amount, referenceSeed, senderPubkey, receiverWallet } = params;

    if (!receiverWallet.connected || !receiverWallet.publicKey) {
        throw new Error('Wallet not connected');
    }

    const connection = getConnection();

    try {
        const amountLamports = solToLamports(amount);
        const senderPublicKey = validateSolanaAddress(senderPubkey);

        const program = getProgram(receiverWallet, connection);

        // Derive the remittance PDA using the same logic as creation
        const [remittancePda] = derivePDA(program, senderPublicKey, receiverWallet.publicKey, referenceSeed);

        // Check if remittance exists
        const remittanceAccount = await program.account.remittance.fetchNullable(remittancePda);
        if (!remittanceAccount) {
            throw new Error('Remittance not found or already claimed');
        }

        // Verify the amount matches
        if (!remittanceAccount.amount.eq(amountLamports)) {
            throw new Error('Amount mismatch - this remittance may have been tampered with');
        }

        // Check receiver balance for transaction fees
        const receiverBalance = await connection.getBalance(receiverWallet.publicKey);
        if (receiverBalance < 5000) { // 0.000005 SOL for transaction fees
            throw new Error('Insufficient balance for transaction fees');
        }

        notify('Claiming remittance...', 'info');

        // Execute claim transaction
        const txSignature = await program.methods
            .claim(
                referenceSeed,
                false, // is_token_transfer (false for SOL)
                amountLamports,
                9 // decimals (9 for SOL)
            )
            .accountsPartial({
                sender: senderPublicKey,
                receiver: receiverWallet.publicKey,
                remittance: remittancePda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        notify('Confirming transaction...', 'info');

        // Confirm the transaction
        const latestBlockHash = await connection.getLatestBlockhash('confirmed');
        await connection.confirmTransaction({
            signature: txSignature,
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        }, 'confirmed');

        return {
            txSignature,
            amountClaimed: parseFloat(amount),
        };

    } catch (error: any) {
        let errorMessage = 'Failed to claim remittance';

        if (error.message?.includes('User rejected')) {
            errorMessage = 'Transaction was cancelled by user';
        } else if (error.message?.includes('Remittance not found')) {
            errorMessage = 'This remittance has already been claimed or does not exist';
        } else if (error.message?.includes('Amount mismatch')) {
            errorMessage = 'Invalid remittance data - amount verification failed';
        } else if (error.message?.includes('Insufficient balance')) {
            errorMessage = error.message;
        } else if (error.error?.errorMessage) {
            // Anchor program errors
            errorMessage = error.error.errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error('Claim error:', error);
        throw new Error(errorMessage);
    }
}

export async function createRemittance(params: CreateRemittanceParams): Promise<RemittanceResult> {
    const { amount, receiverWallet, senderWallet } = params;

    if (!senderWallet.connected || !senderWallet.publicKey) {
        throw new Error('Wallet not connected');
    }

    const connection = getConnection();

    try {
        const amountLamports = solToLamports(amount);

        const referenceSeed = generateReferenceSeed();

        const receiverPubkey = receiverWallet
            ? validateSolanaAddress(receiverWallet)
            : senderWallet.publicKey;

        if (receiverWallet && receiverPubkey.equals(senderWallet.publicKey)) {
            throw new Error('Cannot send remittance to yourself');
        }

        const program = getProgram(senderWallet, connection);

        const [remittancePda] = derivePDA(program, senderWallet.publicKey, receiverPubkey, referenceSeed);
        const [statsPda] = deriveStatsPDA(program, senderWallet.publicKey);

        const senderBalance = await connection.getBalance(senderWallet.publicKey);
        const requiredBalance = amountLamports.toNumber() + 5000000; // Extra for transaction fees and rent

        if (senderBalance < requiredBalance) {
            throw new Error(`Insufficient balance. Required: ${requiredBalance / LAMPORTS_PER_SOL} SOL, Available: ${senderBalance / LAMPORTS_PER_SOL} SOL`);
        }

        notify('Creating remittance transaction...', 'info');

        const txSignature = await program.methods
            .initialize(amountLamports, referenceSeed)
            .accountsPartial({
                sender: senderWallet.publicKey,
                receiver: receiverPubkey,
                remittance: remittancePda,
                stats: statsPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        notify('Confirming transaction...', 'info');

        const latestBlockHash = await connection.getLatestBlockhash('confirmed');
        await connection.confirmTransaction({
            signature: txSignature,
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        }, 'confirmed');

        const qrUrl = generateSolanaPayUrl(
            receiverWallet ? receiverPubkey : null,
            amount,
            referenceSeed,
            senderWallet.publicKey
        );

        return {
            pda: remittancePda.toBase58(),
            refSeed: referenceSeed,
            qrUrl,
            txSignature,
        };

    } catch (error: any) {
        let errorMessage = 'Failed to create remittance';

        if (error.message?.includes('User rejected')) {
            errorMessage = 'Transaction was cancelled by user';
        } else if (error.message?.includes('Insufficient balance')) {
            errorMessage = error.message;
        } else if (error.message?.includes('Invalid amount')) {
            errorMessage = error.message;
        } else if (error.message?.includes('Cannot send remittance to yourself')) {
            errorMessage = error.message;
        } else if (error.message?.includes('Invalid Solana address')) {
            errorMessage = 'Please enter a valid Solana wallet address';
        } else if (error.error?.errorMessage) {
            // Anchor program errors (like InvalidAmount, SelfTransfer, etc.)
            errorMessage = error.error.errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error('Remittance creation error:', error);
        throw new Error(errorMessage);
    }
} 