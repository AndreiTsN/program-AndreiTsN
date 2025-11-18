// src/anchorClient.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl_anchor_project.json";

// Program ID: from declare_id! or IDL metadata.address
export const PROGRAM_ID = new PublicKey(
  // @ts-ignore
  (idl as any).metadata?.address ?? "5u8KdFByQxwVdc6orGV5gUJL5avYc5VFvgfSj1eXD2Pw"
);

export const SPLITTER_SEED = "splitter";

export function getProvider(): anchor.AnchorProvider {
  const provider = anchor.getProvider();
  if (!provider) {
    throw new Error("Anchor provider not set");
  }
  return provider as anchor.AnchorProvider;
}

export function getProgram(): anchor.Program {
  const provider = getProvider();
  return new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);
}

export function getSplitterPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SPLITTER_SEED), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export { SystemProgram };
