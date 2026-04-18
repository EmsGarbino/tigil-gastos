use super::*;
use soroban_sdk::{Env, Address};
use soroban_sdk::testutils::Address as _;

#[test]
fn test_set_goal() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TigilGastosContract);
    let client = TigilGastosContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    client.create_goal(&user, &1000);
    let goal = client.get_goal(&user);
    assert_eq!(goal, 1000);
}

#[test]
fn test_deposit() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TigilGastosContract);
    let client = TigilGastosContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    client.create_goal(&user, &1000);
    client.deposit(&user, &300);
    let saved = client.get_saved(&user);
    assert_eq!(saved, 300);
}

#[test]
fn test_claim_success() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TigilGastosContract);
    let client = TigilGastosContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    client.create_goal(&user, &500);
    client.deposit(&user, &500);
    let claimed = client.claim(&user);
    assert_eq!(claimed, 500);
}

#[test]
#[should_panic(expected = "Goal not reached")]
fn test_claim_fail() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TigilGastosContract);
    let client = TigilGastosContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    client.create_goal(&user, &1000);
    client.deposit(&user, &200);
    client.claim(&user);
}