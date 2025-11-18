import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  SystemProgram,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";
import { AnchorProject } from "../target/types/anchor_project";

describe("anchor_project (revenue splitter)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .AnchorProject as Program<AnchorProject>;

  const authority = provider.wallet;
  const recipient1 = Keypair.generate();
  const recipient2 = Keypair.generate();

  let splitterPda: PublicKey;

  const getBalance = (pk: PublicKey) =>
    provider.connection.getBalance(pk);

  const airdropIfNeeded = async (pubkey: PublicKey, minLamports: number) => {
    const current = await getBalance(pubkey);
    if (current < minLamports) {
      const sig = await provider.connection.requestAirdrop(
        pubkey,
        minLamports - current
      );
      await provider.connection.confirmTransaction(sig);
    }
  };

  // ---------------------------
  // INITIALIZE (2 happy + 2 unhappy)
  // ---------------------------

  it("initialize #1: creates splitter with 2 recipients", async () => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), authority.publicKey.toBuffer()],
      program.programId
    );
    splitterPda = pda;

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 1,
        },
        {
          wallet: recipient2.publicKey,
          share: 3,
        },
      ])
      .accounts({
        authority: authority.publicKey,
        splitter: splitterPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const splitter = await program.account.splitter.fetch(splitterPda);
    assert.equal(
      splitter.authority.toBase58(),
      authority.publicKey.toBase58()
    );
    assert.equal(splitter.recipients.length, 2);
    assert.equal(
      splitter.recipients[0].wallet.toBase58(),
      recipient1.publicKey.toBase58()
    );
    assert.equal(
      splitter.recipients[1].wallet.toBase58(),
      recipient2.publicKey.toBase58()
    );
    assert.equal(splitter.totalShares, 4);
  });

  it("initialize #2: creates splitter for another authority", async () => {
    const otherAuthority = Keypair.generate();

    await airdropIfNeeded(
      otherAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const [otherPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), otherAuthority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 2,
        },
        {
          wallet: recipient2.publicKey,
          share: 2,
        },
      ])
      .accounts({
        authority: otherAuthority.publicKey,
        splitter: otherPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([otherAuthority])
      .rpc();

    const splitter = await program.account.splitter.fetch(otherPda);
    assert.equal(
      splitter.authority.toBase58(),
      otherAuthority.publicKey.toBase58()
    );
    assert.equal(splitter.recipients.length, 2);
    assert.equal(splitter.totalShares, 4);
  });

  it("initialize (unhappy #1): fails on empty recipients", async () => {
    const fakeAuthority = Keypair.generate();
    await airdropIfNeeded(
      fakeAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), fakeAuthority.publicKey.toBuffer()],
      program.programId
    );

    let failed = false;
    try {
      await program.methods
        .initialize([])
        .accounts({
          authority: fakeAuthority.publicKey,
          splitter: pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([fakeAuthority])
        .rpc();
    } catch (_e: any) {
      failed = true;
    }
    if (!failed) {
      assert.fail("Expected initialize to fail for empty recipients");
    }
  });

  it("initialize (unhappy #2): fails on zero share", async () => {
    const fakeAuthority = Keypair.generate();
    await airdropIfNeeded(
      fakeAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), fakeAuthority.publicKey.toBuffer()],
      program.programId
    );

    let failed = false;
    try {
      await program.methods
        .initialize([
          {
            wallet: recipient1.publicKey,
            share: 0,
          },
        ])
        .accounts({
          authority: fakeAuthority.publicKey,
          splitter: pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([fakeAuthority])
        .rpc();
    } catch (_e: any) {
      failed = true;
    }
    if (!failed) {
      assert.fail("Expected initialize to fail for zero share");
    }
  });

  // ---------------------------
  // DISTRIBUTE (2 happy + 2 unhappy)
  // ---------------------------

  it("distribute #1: splits deposited lamports according to shares", async () => {
    const depositLamports = 1 * LAMPORTS_PER_SOL;

    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: splitterPda,
        lamports: depositLamports,
      })
    );
    await provider.sendAndConfirm(tx);

    const before1 = await getBalance(recipient1.publicKey);
    const before2 = await getBalance(recipient2.publicKey);

    await program.methods
      .distribute()
      .accounts({
        splitter: splitterPda,
        authority: authority.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: recipient1.publicKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: recipient2.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ])
      .rpc();

    const after1 = await getBalance(recipient1.publicKey);
    const after2 = await getBalance(recipient2.publicKey);

    const delta1 = after1 - before1;
    const delta2 = after2 - before2;
    const distributed = delta1 + delta2;

    assert.isAbove(distributed, depositLamports * 0.9);

    const ratio = delta2 / delta1;
    assert.isAbove(ratio, 2.5);
    assert.isBelow(ratio, 3.5);
  });

  it("distribute #2: can distribute again after new deposit", async () => {
    const depositLamports = 0.5 * LAMPORTS_PER_SOL;

    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: splitterPda,
        lamports: depositLamports,
      })
    );
    await provider.sendAndConfirm(tx);

    const before1 = await getBalance(recipient1.publicKey);
    const before2 = await getBalance(recipient2.publicKey);

    await program.methods
      .distribute()
      .accounts({
        splitter: splitterPda,
        authority: authority.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: recipient1.publicKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: recipient2.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ])
      .rpc();

    const after1 = await getBalance(recipient1.publicKey);
    const after2 = await getBalance(recipient2.publicKey);

    const delta1 = after1 - before1;
    const delta2 = after2 - before2;

    assert.isAbove(delta1, 0);
    assert.isAbove(delta2, 0);

  });

  it("distribute (unhappy #1): fails when no funds to distribute", async () => {
    let failed = false;
    try {
      await program.methods
        .distribute()
        .accounts({
          splitter: splitterPda,
          authority: authority.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: recipient1.publicKey,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: recipient2.publicKey,
            isSigner: false,
            isWritable: true,
          },
        ])
        .rpc();
    } catch (_e: any) {
      failed = true;
    }
    if (!failed) {
      assert.fail(
        "Expected distribute to fail when no extra funds are available"
      );
    }
  });

  it("distribute (unhappy #2): fails for wrong authority", async () => {
    const wrongAuthority = Keypair.generate();
    await airdropIfNeeded(
      wrongAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: splitterPda,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx);

    let failed = false;
    try {
      await program.methods
        .distribute()
        .accounts({
          splitter: splitterPda,
          authority: wrongAuthority.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: recipient1.publicKey,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: recipient2.publicKey,
            isSigner: false,
            isWritable: true,
          },
        ])
        .signers([wrongAuthority])
        .rpc();
    } catch (_e: any) {
      failed = true;
    }
    if (!failed) {
      assert.fail("Expected distribute to fail for wrong authority");
    }

    await program.methods
      .distribute()
      .accounts({
        splitter: splitterPda,
        authority: authority.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: recipient1.publicKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: recipient2.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ])
      .rpc();
  });

  // ---------------------------
  // CLOSE (2 happy + 2 unhappy)
  // ---------------------------

  it("close #1: closes a freshly created splitter without deposits", async () => {
    const tempAuthority = Keypair.generate();
    await airdropIfNeeded(
      tempAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const [tempPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), tempAuthority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 1,
        },
        {
          wallet: recipient2.publicKey,
          share: 1,
        },
      ])
      .accounts({
        authority: tempAuthority.publicKey,
        splitter: tempPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([tempAuthority])
      .rpc();

    await program.methods
      .close()
      .accounts({
        splitter: tempPda,
        authority: tempAuthority.publicKey,
      })
      .signers([tempAuthority])
      .rpc();

    let closed = false;
    try {
      await program.account.splitter.fetch(tempPda);
    } catch (_e: any) {
      closed = true;
    }
    assert.isTrue(closed, "Temporary splitter should be closed");
  });

  it("close #2: closes splitter after distribute (only rent left)", async () => {
    const tempAuthority = Keypair.generate();
    await airdropIfNeeded(
      tempAuthority.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    const [tempPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), tempAuthority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 1,
        },
        {
          wallet: recipient2.publicKey,
          share: 1,
        },
      ])
      .accounts({
        authority: tempAuthority.publicKey,
        splitter: tempPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([tempAuthority])
      .rpc();

    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tempAuthority.publicKey,
        toPubkey: tempPda,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx, [tempAuthority]);

    await program.methods
      .distribute()
      .accounts({
        splitter: tempPda,
        authority: tempAuthority.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: recipient1.publicKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: recipient2.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ])
      .signers([tempAuthority])
      .rpc();

    await program.methods
      .close()
      .accounts({
        splitter: tempPda,
        authority: tempAuthority.publicKey,
      })
      .signers([tempAuthority])
      .rpc();

    let closed = false;
    try {
      await program.account.splitter.fetch(tempPda);
    } catch (_e: any) {
      closed = true;
    }
    assert.isTrue(closed, "Splitter should be closed after distribute + close");
  });

  it("close (unhappy #1): fails when splitter still has funds", async () => {
    const tempAuthority = Keypair.generate();
    await airdropIfNeeded(
      tempAuthority.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    const [tempPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), tempAuthority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 1,
        },
        {
          wallet: recipient2.publicKey,
          share: 1,
        },
      ])
      .accounts({
        authority: tempAuthority.publicKey,
        splitter: tempPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([tempAuthority])
      .rpc();

    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tempAuthority.publicKey,
        toPubkey: tempPda,
        lamports: 0.2 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx, [tempAuthority]);

    let failed = false;
    try {
      await program.methods
        .close()
        .accounts({
          splitter: tempPda,
          authority: tempAuthority.publicKey,
        })
        .signers([tempAuthority])
        .rpc();
    } catch (e: any) {
      failed = true;
      const msg =
        e.error?.errorMessage?.toLowerCase() ||
        e.toString().toLowerCase();
      assert.include(
        msg,
        "splitter still has funds",
        "Expected SplitterHasFunds error"
      );
    }
    if (!failed) {
      assert.fail(
        "Expected close to fail when splitter still has funds"
      );
    }
  });

  it("close (unhappy #2): fails for wrong authority", async () => {
    const tempAuthority = Keypair.generate();
    const wrongAuthority = Keypair.generate();

    await airdropIfNeeded(
      tempAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );
    await airdropIfNeeded(
      wrongAuthority.publicKey,
      0.5 * LAMPORTS_PER_SOL
    );

    const [tempPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter"), tempAuthority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initialize([
        {
          wallet: recipient1.publicKey,
          share: 1,
        },
        {
          wallet: recipient2.publicKey,
          share: 1,
        },
      ])
      .accounts({
        authority: tempAuthority.publicKey,
        splitter: tempPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([tempAuthority])
      .rpc();

    let failed = false;
    try {
      await program.methods
        .close()
        .accounts({
          splitter: tempPda,
          authority: wrongAuthority.publicKey,
        })
        .signers([wrongAuthority])
        .rpc();
    } catch (_e: any) {
      failed = true;
    }
    if (!failed) {
      assert.fail("Expected close to fail for wrong authority");
    }
  });
});
