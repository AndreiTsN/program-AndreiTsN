// src/anchorClient.ts
import type { Idl } from "@coral-xyz/anchor";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl_anchor_project.json";

export const PROGRAM_ID = new PublicKey(
  // @ts-ignore
  (idl as any).address
);

export { SystemProgram };

export function getProgram(connection: Connection, wallet: any) {
  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });

  setProvider(provider);

  return new Program(idl as Idl, provider as any) as any;
}

// ✅ PDA сплиттера без Buffer: seeds = ["splitter", authority]
export function getSplitterPda(authority: PublicKey): PublicKey {
  const seed = new TextEncoder().encode("splitter"); // Uint8Array

  const [pda] = PublicKey.findProgramAddressSync(
    [seed, authority.toBuffer()], // authority.toBuffer() ок, это внутри web3.js
    PROGRAM_ID
  );
  return pda;
}
