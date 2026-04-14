from eth_account import Account

# Private keys from your setup
deployer_key = '0x39f3df57550a973ea4fd02feedff0a0a07f23ff7f2e7c1e5ca0ce21ce394e09b'
broadcaster_key = '0x74b4c4118f72405a66e25a68b5afd54b7220c427d671a8f8854ebd2a6c897779'
oracle_key = '0x3e2922b10e3b1496a96642fed81e8fada5def58b244cedbe71188a0b9f573924'

# Derive addresses
deployer_acct = Account.from_key(deployer_key)
broadcaster_acct = Account.from_key(broadcaster_key)
oracle_acct = Account.from_key(oracle_key)

print('=== WALLET ADDRESSES ===')
print(f'DEPLOYER_PRIVATE_KEY={deployer_key}')
print(f'DEPLOYER_ADDRESS={deployer_acct.address}')
print()
print(f'PLATFORM_WALLET={broadcaster_acct.address}')
print()
print(f'ORACLE_WALLET={oracle_acct.address}')
