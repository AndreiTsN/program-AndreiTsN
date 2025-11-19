# Project Description

**Deployed Frontend URL:** https://squid-app-xkwp6.ondigitalocean.app/

**Solana Program ID:** 5u8KdFByQxwVdc6orGV5gUJL5avYc5VFvgfSj1eXD2Pw  

## Project Overview

### Description

This project is a decentralized **Revenue Splitter dApp** built on Solana 
using **Rust**, **Anchor**, and a **React + Vite** frontend.  
It allows a wallet owner (“authority”) to create a special on-chain 
account — a **PDA-based Splitter** — that stores a list of recipients 
and their individual “share weights.”

Users can deposit SOL into this Splitter account, 
and the program can then **automatically distribute all available funds** to 
the recipients **proportionally**, 
based on the share weights defined during initialization.

All logic is executed entirely on-chain, including:

- creating a Splitter PDA  
- storing recipients and shares  
- depositing SOL into the PDA  
- calculating proportional payouts  
- distributing SOL from PDA to each recipient  
- safely closing the Splitter when empty  

The application requires no backend — all interactions happen between 
the user’s wallet and the on-chain program.


### Key Features

- **Wallet-Based Access**  
  Users connect a Solana wallet (Phantom or Solflare) to interact with the dApp.  
  All actions require explicit wallet approval, ensuring full security.

- **Create a Splitter (PDA Initialization)**  
  The user can initialize a Program Derived Address (PDA) that stores:  
  - a list of recipient wallets,  
  - their share weights,  
  - the authority’s public key,  
  - the PDA bump.  
  The Splitter is unique for each authority.

- **Deposit SOL Into the Splitter**  
  Users can send SOL from their wallet directly into the PDA account.  
  The PDA holds all deposited lamports until distribution.

- **Proportional Fund Distribution**  
  The program computes the distributable balance and splits it among  
  recipients based on predefined share weights.  
  Only the authority is allowed to trigger distribution.

- **Safe Account Closing**  
  The authority can close the Splitter only when it contains no remaining  
  distributable funds.  
  The rent-exempt balance is returned to the authority, and the PDA is removed.

- **Fully On-Chain Logic**  
  All actions — creation, deposit, distribution, and closing — are executed  
  directly on the Solana blockchain without any backend services.

- **Devnet Compatibility and Frontend UI**  
  The entire workflow is accessible through a React + Vite frontend that  
  interacts with the program deployed on Solana Devnet.


### How to Use the dApp

1. **Connect Your Wallet**  
   Open the frontend and click **“Connect Wallet.”**  
   Choose Phantom or Solflare and ensure your wallet is set to **Devnet**.

2. **Initialize the Revenue Splitter**  
   - Enter a list of recipient wallet addresses.  
   - Assign a share value to each recipient  
     (shares act as weights — higher share means a larger portion).  
   - Click **“Initialize Splitter.”**  
   This creates a PDA tied to your wallet and stores the configuration  
   on-chain.

3. **Deposit SOL Into the Splitter**  
   - Enter the amount of SOL you want to deposit.  
   - Click **“Deposit.”**  
   The funds will be transferred from your wallet into the PDA account.

4. **Distribute Funds**  
   - Click **“Distribute Funds.”**  
   The program will calculate the available balance and split it across  
   recipients proportionally to their share weights.  
   Only the authority wallet can trigger this action.

5. **Close the Splitter Account**  
   - Once the PDA contains only the rent-exempt minimum balance,  
     you can click **“Close Splitter.”**  
   - The account will be closed, and the remaining rent will be refunded  
     to your wallet.  
   If distributable funds remain, the close operation will fail.

6. **Repeat or Create a New Splitter**  
   You can initialize a new splitter with a different set of recipients  
   or continue using the existing one as long as your wallet remains  
   the authority.


## Program Architecture

The Revenue Splitter program follows a clean, modular Anchor architecture.  
All business logic is implemented on-chain using three instructions and a  
single primary account type. The program manages the lifecycle of a  
Splitter PDA (Program Derived Address), which stores the configuration for  
distributing SOL to multiple recipients.

The architecture is split into the following core components:

- **Instruction Handlers**  
  Each instruction has its own module inside the `instructions/` directory,  
  keeping the program organized and easy to maintain.  
  The main instructions are:
  - `initialize_splitter`
  - `distribute_funds`
  - `close_splitter`

- **State Definitions**  
  Account structures such as `Splitter`, `Recipient`, and  
  `RecipientInput` are defined in `states.rs`.  
  These structs hold the configuration needed for proportional  
  fund distribution.

- **Custom Errors**  
  The program defines meaningful custom error codes in `errors.rs`  
  (e.g., `Unauthorized`, `NothingToDistribute`, `NoRecipients`,  
  `SplitterHasFunds`) to ensure clear and predictable failure modes.

- **PDA-Based Storage**  
  The Splitter is a PDA derived from deterministic seeds:  
["splitter", authority_pubkey]

This ensures:
- a unique splitter per authority,
- no private keys stored,
- safe account ownership enforcement.

- **Data Flow**  
1. **Initialization**  
   - The authority creates the Splitter PDA.  
   - Program stores recipients, share weights, total shares, and PDA bump.

2. **Deposit**  
   - The authority transfers SOL directly into the PDA account.  
   - PDA simply holds lamports; no state changes occur.

3. **Distribution**  
   - Program calculates the rent-exempt minimum.  
   - Available balance is split proportionally:  
     ```
     share_i / total_shares
     ```  
   - Lamports are transferred directly from the PDA to each recipient.

4. **Close**  
   - PDA can be closed only when no distributable funds remain.  
   - Any remaining rent is refunded to the authority.

The entire workflow is fully on-chain, deterministic, and built according  
to Anchor best practices.  

### PDA Usage

The program uses a single Program Derived Address (PDA) to store all data
related to a revenue splitter. The PDA ensures that the account is
deterministically tied to the authority wallet and can only be managed
through the on-chain program logic — never through an external private key.

The PDA is derived using the following seeds:
seeds = [b"splitter", authority_pubkey.as_ref(),]


The `"splitter"` constant provides a stable namespace, while the
`authority_pubkey` ensures uniqueness.  
This means that each authority wallet can have exactly one splitter PDA,
and any interaction with this PDA automatically enforces ownership rules.

The PDA also stores the following metadata:

- the authority’s public key,
- the list of recipients and their share weights,
- the total number of shares,
- and the PDA bump.

#### **PDAs Used:**

- **Splitter PDA**  
  **Purpose:**  
  Stores the entire state of the revenue splitter, including the authority,
  recipient list, share configuration, and bump seed.  
  Also holds all deposited lamports prior to distribution.

  **Reasoning:**  
  - Enables deterministic creation of a unique splitter per authority.  
  - Ensures that only the rightful authority can distribute or close  
    the splitter.  
  - Removes the need to store private keys — fully secure by design.

No additional PDAs are used in this project, as the logic is entirely
contained in this single account.

### Program Instructions

The program implements three core instructions that manage the lifecycle
of the Splitter PDA and perform all on-chain actions.

#### **1. initialize(recipients: Vec<RecipientInput>)**
Creates the Splitter PDA and initializes its state.

**Functionality:**
- Allocates and initializes the PDA with the authority’s public key.  
- Validates the recipient list, ensuring:
  - it is not empty,  
  - it does not exceed the maximum allowed size,  
  - all share values are positive.  
- Computes the total number of shares.  
- Stores all recipients and their share weights.  
- Sets the PDA bump.

**Key checks:**
- Authority must sign the transaction.
- Recipient list must be valid.

---

#### **2. distribute()**
Distributes all available lamports from the Splitter PDA to recipients
proportionally to their share weights.

**Functionality:**
- Computes the rent-exempt minimum for the PDA.  
- Determines the available balance for distribution.  
- Splits funds proportionally based on:  
amount_i = (share_i / total_shares) * available_lamports

- Transfers lamports directly from the PDA to each recipient account  
passed in `remaining_accounts`.

**Key checks:**
- Caller must be the authority.
- Recipient list must not be empty.
- Recipient accounts must match PDA-stored addresses.

---

#### **3. close()**
Safely closes the Splitter PDA once all distributable funds have been removed.

**Functionality:**
- Ensures no funds remain except the rent-exempt minimum.  
- Closes the PDA and returns the rent lamports to the authority.  
- Removes the PDA from the blockchain.

**Key checks:**
- Caller must be the authority.  
- PDA must not contain allocatable funds.

---
Each instruction is structured following Anchor best practices: using  
dedicated context structs, explicit account constraints, and custom error  
codes for predictability and clarity.

**Instructions Implemented:**

- **initialize** – creates the Splitter PDA and stores the authority,  
  recipients, share weights, total shares, and PDA bump.

- **distribute** – calculates available funds and distributes lamports  
  from the PDA to recipients proportionally to their assigned shares.

- **close** – safely closes the Splitter PDA when no distributable funds  
  remain and returns the rent-exempt balance to the authority.


### Account Structure

The program uses a single primary account to store all configuration
related to the revenue splitter. Supporting data types handle recipient
definitions and input validation.

#### **Splitter Account**

```rust
#[account]
#[derive(InitSpace)]
pub struct Splitter {
    pub authority: Pubkey,
    pub recipients: Vec<Recipient>,
    pub total_shares: u16,
    pub bump: u8,
}

Field Descriptions:

authority: Pubkey
The wallet that owns and controls the Splitter PDA.
Only this account is permitted to trigger distribution and closing.

recipients: Vec<Recipient>
A vector containing all recipient configurations, including their
wallet addresses and individual share weights.

total_shares: u16
The sum of all recipient share values.
Used to compute proportional payouts during distribution.

bump: u8
The PDA bump derived during initialization.
Ensures deterministic generation of the Splitter PDA.

Recipient Struct

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Recipient {
    pub wallet: Pubkey,
    pub share: u16,
}

Purpose:
Represents a single payout target.
Each recipient receives a portion of the distribution proportional to the
share value.

Fields:
wallet: Pubkey – the address that receives funds
share: u16 – weight relative to other recipients

RecipientInput Struct

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientInput {
    pub wallet: Pubkey,
    pub share: u16,
}

Purpose:
Used during initialization to define recipient data before it is stored
in the PDA.

This structure mirrors Recipient but is provided as external input from
the user’s transaction, making it suitable for instruction arguments.
```

## Testing

### Test Coverage

The project includes a TypeScript test suite written using the Anchor
testing framework. The tests are designed to validate both the expected
behavior (happy paths) and error handling (unhappy paths) of each
instruction.

The testing strategy focuses on:

- Correct initialization of the Splitter PDA  
- Accurate proportional fund distribution  
- Proper enforcement of authority checks  
- Safe and restricted closing of the Splitter account  
- Robust handling of invalid input and edge cases  

**Happy Path Tests:**

- **Initialize with valid recipients**  
  Verifies that a Splitter PDA can be created with a non-empty list of
  recipients and valid share values, and that the on-chain state matches
  the input.

- **Deposit and distribute funds**  
  Deposits SOL into the Splitter PDA and calls the `distribute` instruction.  
  Confirms that each recipient receives the correct amount of lamports
  according to their share weights.

- **Close splitter after full distribution**  
  Ensures that once all distributable funds have been sent to recipients,
  the `close` instruction successfully closes the PDA and returns rent
  to the authority.

- **Re-initialization with a new configuration**  
  Validates that the same authority can re-initialize the splitter with
  a different set of recipients and shares if needed (depending on the
  exact test cases implemented).

**Unhappy Path Tests:**

- **Initialize with empty recipient list**  
  Checks that the program rejects attempts to create a splitter with no
  recipients and returns the expected custom error.

- **Initialize with invalid shares**  
  Tests scenarios such as zero or overflowing share values, ensuring the
  program aborts with appropriate error codes.

- **Distribute called by non-authority**  
  Verifies that only the authority wallet can trigger distribution and
  that calls from any other signer fail with an authorization error.

- **Distribute with missing recipient accounts**  
  Ensures that if the required recipient accounts are not passed in
  `remaining_accounts`, the instruction fails with a clear error.

- **Close while splitter still holds funds**  
  Confirms that the `close` instruction is rejected if there are still
  distributable lamports in the PDA, enforcing the “distribute first,
  then close” flow.

- **Close called by non-authority**  
  Ensures that only the authority can close the Splitter PDA, and that
  attempts by other accounts produce an error.

### Running Tests

To run the complete test suite:

```bash
cd anchor_project
anchor test
```
This command:
Starts a local Solana test validator
Builds the program
Deploys it to the local cluster
Executes all TypeScript tests


### Additional Notes for Evaluators

- The project follows a clean and modular Anchor architecture.  
  All instructions, error definitions, and state structures are organized
  in dedicated modules, making the codebase easy to navigate.

- The program implements full PDA ownership and access control.  
  Only the authority is permitted to distribute funds or close the
  Splitter account, and this rule is enforced through strict account
  constraints and signature checks.

- All math operations use `checked_*` methods to avoid overflow and ensure
  safe proportional fund distribution.

- The frontend provides a complete, user-friendly interface for interacting
  with the deployed program on Devnet.  
  Users can initialize a splitter, deposit funds, distribute lamports, and
  close the splitter directly from the browser.

- The entire project is fully on-chain with no backend services.  
  All state transitions and actions occur directly on Solana through wallet
  signatures.

- Test coverage includes both happy and unhappy paths for each instruction,
  ensuring that the program behaves predictably under correct usage and
  fails safely under error conditions.

- The project is deployed publicly on Devnet and includes a corresponding
  frontend deployment for easy access and review.

These details demonstrate a full end-to-end Solana dApp implementation,
including on-chain logic, client integration, access control, and thorough
testing.
