/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bert_staking_sc.json`.
 */
export type BertStakingSc = {
  address: "H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2";
  metadata: {
    name: "bertStakingSc";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claimPositionNft";
      discriminator: [199, 237, 5, 82, 92, 33, 149, 229];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["asset"];
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "config.authority";
                account: "config";
              },
              {
                kind: "account";
                path: "config.id";
                account: "config";
              }
            ];
          };
        },
        {
          name: "userAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "config";
              }
            ];
          };
        },
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "asset";
              }
            ];
          };
        },
        {
          name: "collection";
          docs: ["supposed to be in config also"];
          relations: ["config"];
        },
        {
          name: "updateAuthority";
          signer: true;
        },
        {
          name: "asset";
          writable: true;
        },
        {
          name: "mint";
          docs: ["Token mint."];
          relations: ["config"];
        },
        {
          name: "tokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "coreProgram";
          address: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "claimPositionToken";
      discriminator: [95, 57, 238, 130, 192, 73, 77, 124];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "config.authority";
                account: "config";
              },
              {
                kind: "account";
                path: "config.id";
                account: "config";
              }
            ];
          };
        },
        {
          name: "userAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "config";
              }
            ];
          };
        },
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "position.id";
                account: "positionV2";
              }
            ];
          };
        },
        {
          name: "collection";
          docs: ["supposed to be in config also"];
          relations: ["config"];
        },
        {
          name: "mint";
          docs: ["Token mint."];
          relations: ["config"];
        },
        {
          name: "tokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "authority";
              },
              {
                kind: "arg";
                path: "id";
              }
            ];
          };
        },
        {
          name: "mint";
        },
        {
          name: "collection";
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "id";
          type: "u64";
        },
        {
          name: "lockPeriodYields";
          type: {
            array: [
              {
                defined: {
                  name: "poolConfig";
                };
              },
              4
            ];
          };
        },
        {
          name: "maxCap";
          type: "u64";
        },
        {
          name: "nftValueInTokens";
          type: "u64";
        },
        {
          name: "nftsLimitPerUser";
          type: "u8";
        }
      ];
    },
    {
      name: "initiateUser";
      discriminator: [32, 210, 131, 53, 204, 197, 220, 19];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "config.authority";
                account: "config";
              },
              {
                kind: "account";
                path: "config.id";
                account: "config";
              }
            ];
          };
        },
        {
          name: "userAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "config";
              }
            ];
          };
        },
        {
          name: "mint";
          relations: ["config"];
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "stakeNft";
      discriminator: [38, 27, 66, 46, 69, 65, 151, 219];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["asset"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "config.authority";
                account: "config";
              },
              {
                kind: "account";
                path: "config.id";
                account: "config";
              }
            ];
          };
        },
        {
          name: "userAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "config";
              }
            ];
          };
        },
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "asset";
              }
            ];
          };
        },
        {
          name: "updateAuthority";
          signer: true;
          relations: ["collection"];
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "asset";
          writable: true;
        },
        {
          name: "collection";
          writable: true;
          relations: ["config"];
        },
        {
          name: "coreProgram";
          address: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
        },
        {
          name: "mint";
          relations: ["config"];
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "poolIndex";
          type: "u8";
        }
      ];
    },
    {
      name: "stakeToken";
      discriminator: [191, 127, 193, 101, 37, 96, 87, 211];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
              {
                kind: "account";
                path: "config.authority";
                account: "config";
              },
              {
                kind: "account";
                path: "config.id";
                account: "config";
              }
            ];
          };
        },
        {
          name: "userAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "config";
              }
            ];
          };
        },
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "arg";
                path: "id";
              }
            ];
          };
        },
        {
          name: "mint";
        },
        {
          name: "tokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "const";
                value: [
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
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
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
              ];
            };
          };
          relations: ["config"];
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "poolIndex";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "baseAssetV1";
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0];
    },
    {
      name: "baseCollectionV1";
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0];
    },
    {
      name: "config";
      discriminator: [155, 12, 170, 224, 30, 250, 204, 130];
    },
    {
      name: "positionV2";
      discriminator: [117, 176, 212, 199, 245, 180, 133, 182];
    },
    {
      name: "userAccount";
      discriminator: [211, 33, 136, 16, 186, 110, 242, 127];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "positionLocked";
      msg: "The staking position is still locked";
    },
    {
      code: 6001;
      name: "positionAlreadyClaimed";
      msg: "The staking position has already been claimed";
    },
    {
      code: 6002;
      name: "maxCapReached";
      msg: "Maximum staking capacity reached";
    },
    {
      code: 6003;
      name: "nftLimitReached";
      msg: "NFT limit per user reached";
    },
    {
      code: 6004;
      name: "invalidAmount";
      msg: "Invalid staking amount";
    },
    {
      code: 6005;
      name: "arithmeticOverflow";
      msg: "Arithmetic overflow";
    },
    {
      code: 6006;
      name: "invalidLockPeriodAndYield";
      msg: "Invalid lock period and yield";
    },
    {
      code: 6007;
      name: "invalidPositionType";
      msg: "Invalid position type";
    },
    {
      code: 6008;
      name: "invalidNftMint";
      msg: "Invalid Nft Mint";
    },
    {
      code: 6009;
      name: "alreadyStaked";
      msg: "Already staked";
    },
    {
      code: 6010;
      name: "userTokensLimitCapReached";
      msg: "Tokens limit per user reached";
    },
    {
      code: 6011;
      name: "assetNotStaked";
      msg: "Asset Not Staked";
    },
    {
      code: 6012;
      name: "attributesNotInitialized";
      msg: "Attributes Not Initialized";
    },
    {
      code: 6013;
      name: "invalidTimestamp";
      msg: "Invalid Timestamp";
    }
  ];
  types: [
    {
      name: "baseAssetV1";
      type: {
        kind: "struct";
        fields: [
          {
            name: "key";
            type: {
              defined: {
                name: "key";
              };
            };
          },
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "updateAuthority";
            type: {
              defined: {
                name: "updateAuthority";
              };
            };
          },
          {
            name: "name";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          },
          {
            name: "seq";
            type: {
              option: "u64";
            };
          }
        ];
      };
    },
    {
      name: "baseCollectionV1";
      type: {
        kind: "struct";
        fields: [
          {
            name: "key";
            type: {
              defined: {
                name: "key";
              };
            };
          },
          {
            name: "updateAuthority";
            type: "pubkey";
          },
          {
            name: "name";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          },
          {
            name: "numMinted";
            type: "u32";
          },
          {
            name: "currentSize";
            type: "u32";
          }
        ];
      };
    },
    {
      name: "config";
      type: {
        kind: "struct";
        fields: [
          {
            name: "id";
            type: "u64";
          },
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "collection";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "authorityVault";
            type: "pubkey";
          },
          {
            name: "poolsConfig";
            type: {
              array: [
                {
                  defined: {
                    name: "poolConfig";
                  };
                },
                4
              ];
            };
          },
          {
            name: "poolsStats";
            type: {
              array: [
                {
                  defined: {
                    name: "poolStats";
                  };
                },
                4
              ];
            };
          },
          {
            name: "maxCap";
            type: "u64";
          },
          {
            name: "nftValueInTokens";
            type: "u64";
          },
          {
            name: "nftsLimitPerUser";
            type: "u8";
          },
          {
            name: "totalStakedAmount";
            type: "u64";
          },
          {
            name: "totalNftsStaked";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "authorityVaultBump";
            type: "u8";
          },
          {
            name: "padding";
            type: {
              array: ["u8", 128];
            };
          }
        ];
      };
    },
    {
      name: "key";
      type: {
        kind: "enum";
        variants: [
          {
            name: "uninitialized";
          },
          {
            name: "assetV1";
          },
          {
            name: "hashedAssetV1";
          },
          {
            name: "pluginHeaderV1";
          },
          {
            name: "pluginRegistryV1";
          },
          {
            name: "collectionV1";
          }
        ];
      };
    },
    {
      name: "poolConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lockPeriodDays";
            type: "u16";
          },
          {
            name: "yieldRate";
            type: "u64";
          },
          {
            name: "maxNftsCap";
            type: "u32";
          },
          {
            name: "maxTokensCap";
            type: "u64";
          },
          {
            name: "padding";
            docs: ["Padding"];
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "poolStats";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lockPeriodDays";
            type: "u16";
          },
          {
            name: "totalNftsStaked";
            type: "u32";
          },
          {
            name: "totalTokensStaked";
            type: "u64";
          },
          {
            name: "lifetimeNftsStaked";
            type: "u32";
          },
          {
            name: "lifetimeTokensStaked";
            type: "u64";
          },
          {
            name: "lifetimeClaimedYield";
            type: "u64";
          },
          {
            name: "padding";
            docs: ["Padding"];
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "positionStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "unclaimed";
          },
          {
            name: "claimed";
          }
        ];
      };
    },
    {
      name: "positionType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "nft";
          },
          {
            name: "token";
          }
        ];
      };
    },
    {
      name: "positionV2";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "depositTime";
            type: "i64";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "positionType";
            type: {
              defined: {
                name: "positionType";
              };
            };
          },
          {
            name: "lockPeriodYieldIndex";
            type: "u8";
          },
          {
            name: "unlockTime";
            type: "i64";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "positionStatus";
              };
            };
          },
          {
            name: "nftMints";
            type: {
              array: ["pubkey", 5];
            };
          },
          {
            name: "nftIndex";
            type: "u8";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "id";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "updateAuthority";
      type: {
        kind: "enum";
        variants: [
          {
            name: "none";
          },
          {
            name: "address";
            fields: ["pubkey"];
          },
          {
            name: "collection";
            fields: ["pubkey"];
          }
        ];
      };
    },
    {
      name: "userAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "totalStakedTokenAmount";
            type: "u64";
          },
          {
            name: "totalStakedNfts";
            type: "u32";
          },
          {
            name: "totalStakedValue";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "padding";
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    }
  ];
};
