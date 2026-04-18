#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, Address};

#[contracttype]
pub enum DataKey {
    Goal(Address),
    Saved(Address),
    Locked(Address),
}

#[contract]
pub struct TigilGastosContract;

#[contractimpl]
impl TigilGastosContract {

    pub fn create_goal(env: Env, user: Address, goal: i128) {
        env.storage().persistent().set(&DataKey::Goal(user.clone()), &goal);
        env.storage().persistent().set(&DataKey::Saved(user.clone()), &0i128);
        env.storage().persistent().set(&DataKey::Locked(user), &true);
    }

    pub fn get_goal(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Goal(user)).unwrap_or(0)
    }

    pub fn get_saved(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Saved(user)).unwrap_or(0)
    }

    pub fn deposit(env: Env, user: Address, amount: i128) {
        let saved: i128 = env.storage().persistent().get(&DataKey::Saved(user.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Saved(user), &(saved + amount));
    }

    pub fn claim(env: Env, user: Address) -> i128 {
        let goal: i128 = env.storage().persistent().get(&DataKey::Goal(user.clone())).unwrap();
        let saved: i128 = env.storage().persistent().get(&DataKey::Saved(user.clone())).unwrap();

        if saved >= goal {
            env.storage().persistent().set(&DataKey::Locked(user.clone()), &false);
            return saved;
        }

        panic!("Goal not reached");
    }
}

#[cfg(test)]
mod test;