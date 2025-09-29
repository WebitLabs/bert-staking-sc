
# Init new confgi and it's pools
```bash
# scalling factor of 7 (Pool reward * 100M), 13698630 = 0.1369863014
ts-node ./src/index.ts initialize \
   --mint HgBRWfYxEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump \
   --collection AYh4yso4fZUVHEMMpS3wXxwZt1TgYnbFPb5c4y5LDFFS \
   --admin-withdraw-destination 5oFJzwBqyAmFHafuvbRVG4WkGULqBUfT4JGvuEDzAASm \
   --config-id 2 \
   --max-cap 99999999999 \
   --nft-value 20000 \
   --max-nfts 3 \
   --nft-limit 255 \
   --pool1-lock-days 10 \
   --pool1-yield 13698630 \
   --pool1-max-value 20000000 \
   --pool1-max-tokens 200000 \
   --pool2-lock-days 20 \
   --pool2-yield 43835616 \
   --pool2-max-value 20000000 \
   --pool2-max-tokens 200000 \
   --pool3-lock-days 30 \
   --pool3-yield 98630136 \
   --pool3-max-value 40000000 \
   --pool3-max-tokens 200000 \
   --pool4-lock-days 1 \
   --pool4-yield 27397 \
   --pool4-max-value 1000000 \
   --pool4-max-tokens 65000
```
13,698,630.14
# View program configuration
```bash
ts-node ./src/index.ts fetch-config --config-id 1
ts-node ./src/index.ts fetch-config -c <config-pubkey>
```

# Admin Commands
```bash
# Pause a pool
ts-node ./src/index.ts admin:pause-pool --config-id 2 --pool-index 0

# Activate a paused pool
ts-node ./src/index.ts admin:activate-pool --config-id 2 --pool-index 2  

# Update pool configuration
ts-node ./src/index.ts admin:set-pool-config --pool-index 1 --yield-rate 500 --config-id 1

# set pool yield value (apy * 100M)
ts-node ./src/index.ts admin:set-pool-config --config-id 2  --pool-index 0 --yield-rate 13698630 

# set pool lock days
ts-node ./src/index.ts admin:set-pool-config --config-id 2 --pool-index 0 --lock-days 1 

# Deposit tokens into yield vault for rewards
ts-node ./src/index.ts admin:deposit-yield --amount 10000 --token-mint <TOKEN_MINT> --config-id 1

# Withdraw tokens from yield vault
ts-node ./src/index.ts admin:withdraw-tokens --amount 99.989044 --destination 5oFJzwBqyAmFHafuvbRVG4WkGULqBUfT4JGvuEDzAASm --config-id 2

# Add new pool
ts-node  ./src/index.ts initialize-pool --config-id 2 --index 4 --lock-period-days 365 --yield-rate 500 --max-nfts 3 --max-tokens 200000 --max-value 2000000 
```


# ================ DEV
```bash
ts-node ./src/index.ts initialize \
   --mint Fdsq1yNuCbYX1WcjGz5Sui1td1X1dMdQG6Rm2dj4SWqo \
   --collection 3K3fmD9vap7bcCLSXc8Av6PbjaTpCFVZFDc44ddU7taK \
   --admin-withdraw-destination 8FYZEp3xorQoLe3ngQuGA4B44EXF3j5oUPApJg7GWX7K \
   --config-id 1 \
   --max-cap 99999999999 \
   --nft-value 20000 \
   --max-nfts 3 \
   --nft-limit 255 \
   --pool1-lock-days 10 \
   --pool1-yield 13698630 \
   --pool1-max-value 20000000 \
   --pool1-max-tokens 200000 \
   --pool2-lock-days 20 \
   --pool2-yield 43835616 \
   --pool2-max-value 20000000 \
   --pool2-max-tokens 200000 \
   --pool3-lock-days 30 \
   --pool3-yield 98630136 \
   --pool3-max-value 40000000 \
   --pool3-max-tokens 200000 \
   --pool4-lock-days 1 \
   --pool4-yield 27397 \
   --pool4-max-value 1000000 \
   --pool4-max-tokens 65000
```
