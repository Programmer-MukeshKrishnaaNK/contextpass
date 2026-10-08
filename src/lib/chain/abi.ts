/**
 * ABI of contracts/src/ContextPassPermissions.sol.
 * Generated with: forge inspect ContextPassPermissions abi --json
 * Regenerate after any contract change.
 */
export const contextPassPermissionsAbi = [
  {
    "type": "function",
    "name": "MAX_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPermission",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ContextPassPermissions.Permission",
        "components": [
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "grantedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiresAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revokedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "grantedBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revokedBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "app",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "scope",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantPermission",
    "inputs": [
      {
        "name": "app",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scope",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "expiresAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isPermissionActive",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "permissionId",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "app",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scope",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "permissionsOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "records",
        "type": "tuple[]",
        "internalType": "struct ContextPassPermissions.Permission[]",
        "components": [
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "grantedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiresAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revokedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "grantedBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revokedBlock",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "app",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "scope",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "revokePermission",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "PermissionGranted",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "app",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "scope",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "expiresAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PermissionRevoked",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "app",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyRevoked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidApp",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidExpiry",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidScope",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownPermission",
    "inputs": []
  }
] as const;
