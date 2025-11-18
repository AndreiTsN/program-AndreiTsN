use anchor_lang::prelude::*;

use crate::errors::RevenueError;
use crate::states::{Splitter, SPLITTER_SEED};


pub fn close_splitter(ctx: Context<CloseSplitter>) -> Result<()> {
    let splitter_ai = ctx.accounts.splitter.to_account_info();

    require!(ctx.accounts.authority.is_signer, RevenueError::Unauthorized);

    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(splitter_ai.data_len());
    let current_balance = splitter_ai.lamports();

    require!(
        current_balance <= min_balance,
        RevenueError::SplitterHasFunds
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CloseSplitter<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [SPLITTER_SEED.as_bytes(), authority.key().as_ref()],
        bump = splitter.bump,
        close = authority,
    )]
    pub splitter: Account<'info, Splitter>,

    #[account(mut)]
    pub authority: Signer<'info>,
}
