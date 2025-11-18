use anchor_lang::prelude::*;

use crate::errors::RevenueError;
use crate::states::{Splitter, SPLITTER_SEED};

pub fn distribute_funds(ctx: Context<Distribute>) -> Result<()> {
    let splitter = &ctx.accounts.splitter;
    let authority = &ctx.accounts.authority;
    let splitter_ai = ctx.accounts.splitter.to_account_info();

    require!(authority.is_signer, RevenueError::Unauthorized);

    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(splitter_ai.data_len());
    let current_balance = splitter_ai.lamports();
    require!(
        current_balance > min_balance,
        RevenueError::NothingToDistribute
    );
    let available = current_balance
        .checked_sub(min_balance)
        .ok_or(RevenueError::MathOverflow)?;

    let total_shares = splitter.total_shares as u128;
    let recipients_len = splitter.recipients.len();
    require!(recipients_len > 0, RevenueError::NoRecipients);

    let mut distributed: u64 = 0;

    for (i, r) in splitter.recipients.iter().enumerate() {
        let recipient_ai = ctx
            .remaining_accounts
            .iter()
            .find(|acc| acc.key() == r.wallet)
            .ok_or(RevenueError::MissingRecipientAccount)?;

        let amount: u64 = if i == recipients_len - 1 {
            available
                .checked_sub(distributed)
                .ok_or(RevenueError::MathOverflow)?
        } else {
            let part = (available as u128)
                .checked_mul(r.share as u128)
                .ok_or(RevenueError::MathOverflow)?
                .checked_div(total_shares)
                .ok_or(RevenueError::MathOverflow)? as u64;
            part
        };

        if amount == 0 {
            continue;
        }

        **splitter_ai.try_borrow_mut_lamports()? -= amount;
        **recipient_ai.try_borrow_mut_lamports()? += amount;

        distributed = distributed
            .checked_add(amount)
            .ok_or(RevenueError::MathOverflow)?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [SPLITTER_SEED.as_bytes(), authority.key().as_ref()],
        bump = splitter.bump,
    )]
    pub splitter: Account<'info, Splitter>,

    pub authority: Signer<'info>,
}
