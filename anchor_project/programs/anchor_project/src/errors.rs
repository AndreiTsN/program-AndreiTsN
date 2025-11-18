use anchor_lang::prelude::*;

#[error_code]
pub enum RevenueError {
    #[msg("No recipients provided")]
    NoRecipients,
    #[msg("Too many recipients")]
    TooManyRecipients,
    #[msg("Share value cannot be zero")]
    ZeroShare,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Nothing to distribute")]
    NothingToDistribute,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Missing recipient account in remaining_accounts")]
    MissingRecipientAccount,
    #[msg("Splitter still has funds; distribute before closing")]
    SplitterHasFunds,
}