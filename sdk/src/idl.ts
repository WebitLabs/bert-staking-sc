/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bert_staking_sc.json`.
 */
export type BertStakingSc = {
  "address": "H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2",
  "metadata": {
    "name": "bertStakingSc",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimPosition",
      "discriminator": [
        168,
        90,
        89,
        44,
        203,
        246,
        210,
        46
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "config.id",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "collection",
          "docs": [
            "supposed to be in config also"
          ],
          "relations": [
            "config"
          ]
        },
        {
          "name": "nftMint"
        },
        {
          "name": "mint",
          "docs": [
            "Token mint."
          ],
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftTokenAccount"
        },
        {
          "name": "nftsVault",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "collection"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftsVault"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "lockPeriodYields",
          "type": {
            "array": [
              {
                "defined": {
                  "name": "lockPeriodYield"
                }
              },
              4
            ]
          }
        },
        {
          "name": "maxCap",
          "type": "u64"
        },
        {
          "name": "nftValueInTokens",
          "type": "u64"
        },
        {
          "name": "nftsLimitPerUser",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initiatePosition",
      "discriminator": [
        155,
        183,
        70,
        9,
        176,
        87,
        102,
        8
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "config.id",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "lockPeriodYieldIndex",
          "type": "u8"
        },
        {
          "name": "positionType",
          "type": {
            "defined": {
              "name": "positionType"
            }
          }
        }
      ]
    },
    {
      "name": "stakeNft",
      "discriminator": [
        38,
        27,
        66,
        46,
        69,
        65,
        151,
        219
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "asset"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "config.id",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "updateAuthority",
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "coreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stakeToken",
      "discriminator": [
        191,
        127,
        193,
        101,
        37,
        96,
        87,
        211
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "config.id",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          },
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "baseAssetV1",
      "discriminator": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "name": "baseCollectionV1",
      "discriminator": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "positionLocked",
      "msg": "The staking position is still locked"
    },
    {
      "code": 6001,
      "name": "positionAlreadyClaimed",
      "msg": "The staking position has already been claimed"
    },
    {
      "code": 6002,
      "name": "maxCapReached",
      "msg": "Maximum staking capacity reached"
    },
    {
      "code": 6003,
      "name": "nftLimitReached",
      "msg": "NFT limit per user reached"
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Invalid staking amount"
    },
    {
      "code": 6005,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6006,
      "name": "invalidLockPeriodAndYield",
      "msg": "Invalid lock period and yield"
    },
    {
      "code": 6007,
      "name": "invalidPositionType",
      "msg": "Invalid position type"
    },
    {
      "code": 6008,
      "name": "invalidNftMint",
      "msg": "Invalid Nft Mint"
    },
    {
      "code": 6009,
      "name": "alreadyStaked",
      "msg": "Already staked"
    }
  ],
  "types": [
    {
      "name": "baseAssetV1",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": {
              "defined": {
                "name": "key"
              }
            }
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "updateAuthority",
            "type": {
              "defined": {
                "name": "updateAuthority"
              }
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "seq",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "baseCollectionV1",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": {
              "defined": {
                "name": "key"
              }
            }
          },
          {
            "name": "updateAuthority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "numMinted",
            "type": "u32"
          },
          {
            "name": "currentSize",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "collection",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "nftsVault",
            "type": "pubkey"
          },
          {
            "name": "authorityVault",
            "type": "pubkey"
          },
          {
            "name": "lockPeriodYields",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "lockPeriodYield"
                  }
                },
                4
              ]
            }
          },
          {
            "name": "maxCap",
            "type": "u64"
          },
          {
            "name": "nftValueInTokens",
            "type": "u64"
          },
          {
            "name": "nftsLimitPerUser",
            "type": "u8"
          },
          {
            "name": "totalStakedAmount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authorityVaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "key",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "uninitialized"
          },
          {
            "name": "assetV1"
          },
          {
            "name": "hashedAssetV1"
          },
          {
            "name": "pluginHeaderV1"
          },
          {
            "name": "pluginRegistryV1"
          },
          {
            "name": "collectionV1"
          }
        ]
      }
    },
    {
      "name": "lockPeriod",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "oneDay"
          },
          {
            "name": "threeDays"
          },
          {
            "name": "sevenDays"
          },
          {
            "name": "thirtyDays"
          }
        ]
      }
    },
    {
      "name": "lockPeriodYield",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lockPeriod",
            "type": {
              "defined": {
                "name": "lockPeriod"
              }
            }
          },
          {
            "name": "yieldRate",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "depositTime",
            "type": "i64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "positionType",
            "type": {
              "defined": {
                "name": "positionType"
              }
            }
          },
          {
            "name": "lockPeriodYieldIndex",
            "type": "u8"
          },
          {
            "name": "unlockTime",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "positionStatus"
              }
            }
          },
          {
            "name": "nftMints",
            "type": {
              "array": [
                "pubkey",
                5
              ]
            }
          },
          {
            "name": "nftIndex",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "positionStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unclaimed"
          },
          {
            "name": "claimed"
          }
        ]
      }
    },
    {
      "name": "positionType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "nft"
          },
          {
            "name": "token"
          }
        ]
      }
    },
    {
      "name": "updateAuthority",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "address",
            "fields": [
              "pubkey"
            ]
          },
          {
            "name": "collection",
            "fields": [
              "pubkey"
            ]
          }
        ]
      }
    }
  ]
};
