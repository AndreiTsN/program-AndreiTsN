use anchor_lang::prelude::*;
use crate::states::RecipientInput;

pub mod states;
pub mod errors;
pub mod instructions;

use crate::instructions::*;

declare_id!("5u8KdFByQxwVdc6orGV5gUJL5avYc5VFvgfSj1eXD2Pw");

#[program]
pub mod anchor_project {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        recipients: Vec<RecipientInput>,
    ) -> Result<()> {
        initialize_splitter(ctx, recipients)
    }

    pub fn distribute(ctx: Context<Distribute>) -> Result<()> {
        distribute_funds(ctx)
    }

    pub fn close(ctx: Context<CloseSplitter>) -> Result<()> {
        close_splitter(ctx)
    }
}
