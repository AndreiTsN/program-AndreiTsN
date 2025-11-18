use anchor_lang::prelude::*;

use crate::errors::RevenueError;
use crate::states::{Recipient, RecipientInput, Splitter, MAX_RECIPIENTS, SPLITTER_SEED};

pub fn initialize_splitter(ctx: Context<Initialize>, recipients: Vec<RecipientInput>) -> Result<()> {
    require!(!recipients.is_empty(), RevenueError::NoRecipients);
    require!(recipients.len() <= MAX_RECIPIENTS, RevenueError::TooManyRecipients);

    let mut total_shares: u16 = 0;
    let mut stored: Vec<Recipient> = Vec::with_capacity(recipients.len());

    for r in recipients.iter() {
        require!(r.share > 0, RevenueError::ZeroShare);
        total_shares = total_shares
            .checked_add(r.share)
            .ok_or(RevenueError::MathOverflow)?;
        stored.push(Recipient {
            wallet: r.wallet,
            share: r.share,
        });
    }

    let splitter = &mut ctx.accounts.splitter;
    splitter.authority = ctx.accounts.authority.key();
    splitter.recipients = stored;
    splitter.total_shares = total_shares;
    splitter.bump = ctx.bumps.splitter;

    Ok(())
}

#[derive(Accounts)]
#[instruction(recipients: Vec<RecipientInput>)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        seeds = [SPLITTER_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        space = 8 + Splitter::INIT_SPACE,
    )]
    pub splitter: Account<'info, Splitter>,

    pub system_program: Program<'info, System>,
}
