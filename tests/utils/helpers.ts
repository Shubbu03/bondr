import { PublicKey } from "@solana/web3.js";
import { program } from "./setup";

export interface EscrowPDAs {
    escrowPda: PublicKey;
    escrowBump: number;
    vaultPda: PublicKey;
    vaultBump: number;
}

export interface UserStatsPDA {
    statsPda: PublicKey;
    statsBump: number;
}

export interface FreelancerBadgePDA {
    badgePda: PublicKey;
    badgeBump: number;
}

// PDA derivation helpers
export const deriveEscrowPDAs = async (
    sender: PublicKey,
    receiver: PublicKey,
    refSeed: number
): Promise<EscrowPDAs> => {
    const [escrowPda, escrowBump] = await PublicKey.findProgramAddress(
        [
            Buffer.from("escrow"),
            sender.toBuffer(),
            receiver.toBuffer(),
            Buffer.from([refSeed]),
        ],
        program.programId
    );

    const [vaultPda, vaultBump] = await PublicKey.findProgramAddress(
        [
            Buffer.from("vault"),
            sender.toBuffer(),
            receiver.toBuffer(),
            Buffer.from([refSeed]),
        ],
        program.programId
    );

    return { escrowPda, escrowBump, vaultPda, vaultBump };
};

export const deriveUserStatsPDA = async (user: PublicKey): Promise<UserStatsPDA> => {
    const [statsPda, statsBump] = await PublicKey.findProgramAddress(
        [Buffer.from("user_stats"), user.toBuffer()],
        program.programId
    );
    return { statsPda, statsBump };
};

export const deriveFreelancerBadgePDA = async (freelancer: PublicKey): Promise<FreelancerBadgePDA> => {
    const [badgePda, badgeBump] = await PublicKey.findProgramAddress(
        [Buffer.from("badge"), freelancer.toBuffer()],
        program.programId
    );
    return { badgePda, badgeBump };
}; 