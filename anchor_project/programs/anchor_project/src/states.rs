use anchor_lang::prelude::*;


pub const MAX_RECIPIENTS: usize = 10;
pub const SPLITTER_SEED: &str = "splitter";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Recipient {
    pub wallet: Pubkey,
    pub share: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientInput {
    pub wallet: Pubkey,
    pub share: u16,
}


#[account]
#[derive(InitSpace)]
pub struct Splitter {
    pub authority: Pubkey,
    #[max_len(MAX_RECIPIENTS)]
    pub recipients: Vec<Recipient>,
    pub total_shares: u16,
    pub bump: u8,
}
