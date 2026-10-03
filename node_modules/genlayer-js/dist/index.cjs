"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } async function _asyncNullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return await rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }








var _chunkNUO3HSVBcjs = require('./chunk-NUO3HSVB.cjs');














var _chunkFKFYEOS7cjs = require('./chunk-FKFYEOS7.cjs');


var _chunk75ZPJI57cjs = require('./chunk-75ZPJI57.cjs');

// src/client/client.ts






var _viem = require('viem');

// src/accounts/actions.ts
function accountActions(client, publicClient) {
  return {
    fundAccount: async ({ address, amount }) => {
      if (_optionalChain([client, 'access', _ => _.chain, 'optionalAccess', _2 => _2.id]) !== _chunkNUO3HSVBcjs.localnet.id) {
        throw new Error("Client is not connected to the localnet");
      }
      return client.request({
        method: "sim_fundAccount",
        params: [address, amount]
      });
    },
    /**
     * Returns the transaction count (next nonce) for an address.
     *
     * Defaults to `"pending"` so that rapid sequential submissions from the
     * same account receive distinct nonces. Two submissions issued before the
     * first confirms would otherwise both see the same `"latest"` count and
     * collide with an "already known" or "replacement underpriced" error.
     *
     * Pass `block: "latest"` explicitly for confirmed-only state
     * (e.g. reconciliation tooling comparing against on-chain finality).
     */
    getCurrentNonce: async ({
      address,
      block = "pending"
    }) => {
      const addressToUse = address || _optionalChain([client, 'access', _3 => _3.account, 'optionalAccess', _4 => _4.address]);
      if (!addressToUse) {
        throw new Error("No address provided and no account is connected");
      }
      const count = await client.request({
        method: "eth_getTransactionCount",
        params: [addressToUse, block]
      });
      return Number(count);
    },
    /**
     * Sends a native GEN transfer from the connected account.
     *
     * Local-key only: mirrors the staking/vesting executeWrite local lane 1:1
     * (estimateGas → pending nonce → legacy prepareTransactionRequest → sign →
     * sendRawTransaction → wait for receipt). Address-only / injected-provider
     * accounts are intentionally rejected — provider-signed transfers are the
     * wallet's own responsibility.
     */
    transfer: async ({ to, value }) => {
      const account = client.account;
      if (!account || account.type !== "local" || !account.signTransaction) {
        throw new Error(
          "transfer requires a local-key account. Initialize the client with a private-key account created via createAccount()."
        );
      }
      let gasLimit;
      try {
        gasLimit = await publicClient.estimateGas({
          account,
          to,
          value
        });
      } catch (e2) {
        gasLimit = 21000n;
      }
      const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending"
      });
      const txRequest = await publicClient.prepareTransactionRequest({
        account,
        to,
        value,
        type: "legacy",
        nonce,
        gas: gasLimit,
        chain: client.chain
      });
      const signTransaction = account.signTransaction;
      const serializedTx = await signTransaction(txRequest);
      const hash = await publicClient.sendRawTransaction({ serializedTransaction: serializedTx });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error(`Transfer reverted (tx: ${hash})`);
      }
      return receipt;
    }
  };
}

// src/abi/calldata/index.ts
var calldata_exports = {};
_chunk75ZPJI57cjs.__export.call(void 0, calldata_exports, {
  decode: () => decode,
  encode: () => encode,
  makeCalldataObject: () => makeCalldataObject,
  toString: () => toString
});

// src/abi/calldata/consts.ts
var BITS_IN_TYPE = 3;
var TYPE_SPECIAL = 0;
var TYPE_PINT = 1;
var TYPE_NINT = 2;
var TYPE_BYTES = 3;
var TYPE_STR = 4;
var TYPE_ARR = 5;
var TYPE_MAP = 6;
var SPECIAL_NULL = 0 << BITS_IN_TYPE | TYPE_SPECIAL;
var SPECIAL_FALSE = 1 << BITS_IN_TYPE | TYPE_SPECIAL;
var SPECIAL_TRUE = 2 << BITS_IN_TYPE | TYPE_SPECIAL;
var SPECIAL_ADDR = 3 << BITS_IN_TYPE | TYPE_SPECIAL;

// src/abi/calldata/encoder.ts
function reportError(msg, data) {
  throw new Error(`invalid calldata input '${data}'`);
}
function writeNum(to, data) {
  if (data === 0n) {
    to.push(0);
    return;
  }
  while (data > 0) {
    let cur = Number(data & 0x7fn);
    data >>= 7n;
    if (data > 0) {
      cur |= 128;
    }
    to.push(cur);
  }
}
function encodeNumWithType(to, data, type) {
  const res = data << BigInt(BITS_IN_TYPE) | BigInt(type);
  writeNum(to, res);
}
function encodeNum(to, data) {
  if (data >= 0n) {
    encodeNumWithType(to, data, TYPE_PINT);
  } else {
    encodeNumWithType(to, -data - 1n, TYPE_NINT);
  }
}
function compareString(l, r) {
  for (let index = 0; index < l.length && index < r.length; index++) {
    const cur = l[index] - r[index];
    if (cur !== 0) {
      return cur;
    }
  }
  return l.length - r.length;
}
function encodeMap(to, arr) {
  const newEntries = Array.from(
    arr,
    ([k, v]) => [
      Array.from(k, (x) => x.codePointAt(0)),
      new TextEncoder().encode(k),
      v
    ]
  );
  newEntries.sort((v1, v2) => compareString(v1[0], v2[0]));
  for (let i = 1; i < newEntries.length; i++) {
    if (compareString(newEntries[i - 1][0], newEntries[i][0]) === 0) {
      throw new Error(`duplicate key '${new TextDecoder().decode(newEntries[i][1])}'`);
    }
  }
  encodeNumWithType(to, BigInt(newEntries.length), TYPE_MAP);
  for (const [, k, v] of newEntries) {
    writeNum(to, BigInt(k.length));
    for (const c of k) {
      to.push(c);
    }
    encodeImpl(to, v);
  }
}
function encodeImpl(to, data) {
  if (data === null || data === void 0) {
    to.push(SPECIAL_NULL);
    return;
  }
  if (data === true) {
    to.push(SPECIAL_TRUE);
    return;
  }
  if (data === false) {
    to.push(SPECIAL_FALSE);
    return;
  }
  switch (typeof data) {
    case "number": {
      if (!Number.isInteger(data)) {
        reportError("floats are not supported", data);
      }
      encodeNum(to, BigInt(data));
      return;
    }
    case "bigint": {
      encodeNum(to, data);
      return;
    }
    case "string": {
      const str = new TextEncoder().encode(data);
      encodeNumWithType(to, BigInt(str.length), TYPE_STR);
      for (const c of str) {
        to.push(c);
      }
      return;
    }
    case "object": {
      if (data instanceof Uint8Array) {
        encodeNumWithType(to, BigInt(data.length), TYPE_BYTES);
        for (const c of data) {
          to.push(c);
        }
      } else if (data instanceof Array) {
        encodeNumWithType(to, BigInt(data.length), TYPE_ARR);
        for (const c of data) {
          encodeImpl(to, c);
        }
      } else if (data instanceof Map) {
        encodeMap(to, data);
      } else if (data instanceof _chunkFKFYEOS7cjs.CalldataAddress) {
        to.push(SPECIAL_ADDR);
        for (const c of data.bytes) {
          to.push(c);
        }
      } else if (Object.getPrototypeOf(data) === Object.prototype) {
        encodeMap(to, Object.entries(data));
      } else {
        reportError("unknown object type", data);
      }
      return;
    }
    default:
      reportError("unknown base type", data);
  }
}
function encode(data) {
  const arr = [];
  encodeImpl(arr, data);
  return new Uint8Array(arr);
}
function makeCalldataObject(method, args, kwargs) {
  let ret = {};
  if (method) {
    ret[""] = method;
  }
  if (args && args.length > 0) {
    ret["args"] = args;
  }
  if (kwargs) {
    if (kwargs instanceof Map) {
      if (kwargs.size > 0) {
        ret["kwargs"] = kwargs;
      }
    } else {
      let hasVal = false;
      for (const _k in kwargs) {
        hasVal = true;
        break;
      }
      if (hasVal) {
        ret["kwargs"] = kwargs;
      }
    }
  }
  return ret;
}

// src/abi/calldata/decoder.ts
function readULeb128(data, index) {
  let res = 0n;
  let accum = 0n;
  let shouldContinue = true;
  while (shouldContinue) {
    const byte = data[index.i];
    index.i++;
    const rest = byte & 127;
    res += BigInt(rest) * (1n << accum);
    accum += 7n;
    shouldContinue = byte >= 128;
  }
  return res;
}
function decodeImpl(data, index) {
  const cur = readULeb128(data, index);
  switch (cur) {
    case BigInt(SPECIAL_NULL):
      return null;
    case BigInt(SPECIAL_TRUE):
      return true;
    case BigInt(SPECIAL_FALSE):
      return false;
    case BigInt(SPECIAL_ADDR): {
      const res = data.slice(index.i, index.i + 20);
      index.i += 20;
      return new (0, _chunkFKFYEOS7cjs.CalldataAddress)(res);
    }
  }
  const type = Number(cur & 0xffn) & (1 << BITS_IN_TYPE) - 1;
  const rest = cur >> BigInt(BITS_IN_TYPE);
  switch (type) {
    case TYPE_BYTES: {
      const ret = data.slice(index.i, index.i + Number(rest));
      index.i += Number(rest);
      return ret;
    }
    case TYPE_PINT:
      return rest;
    case TYPE_NINT:
      return -1n - rest;
    case TYPE_STR: {
      const ret = data.slice(index.i, index.i + Number(rest));
      index.i += Number(rest);
      return new TextDecoder("utf-8").decode(ret);
    }
    case TYPE_ARR: {
      const ret = [];
      let elems = rest;
      while (elems > 0) {
        elems--;
        ret.push(decodeImpl(data, index));
      }
      return ret;
    }
    case TYPE_MAP: {
      const ret = /* @__PURE__ */ new Map();
      let elems = rest;
      while (elems > 0) {
        elems--;
        const strLen = Number(readULeb128(data, index));
        const key = data.slice(index.i, index.i + strLen);
        index.i += strLen;
        const keyStr = new TextDecoder("utf-8").decode(key);
        ret.set(keyStr, decodeImpl(data, index));
      }
      return ret;
    }
    default:
      throw new Error(`can't decode type from ${type} rest is ${rest} at pos ${index.i}`);
  }
}
function decode(data) {
  const index = { i: 0 };
  const res = decodeImpl(data, index);
  if (index.i !== data.length) {
    throw new Error("some data left");
  }
  return res;
}

// src/abi/calldata/string.ts
function reportError2(msg, data) {
  throw new Error(`invalid calldata input '${data}'`);
}
function toStringImplMap(data, to) {
  to.push("{");
  for (const [k, v] of data) {
    to.push(JSON.stringify(k));
    to.push(":");
    toStringImpl(v, to);
  }
  to.push("}");
}
function toStringImpl(data, to) {
  if (data === null || data === void 0) {
    to.push("null");
    return;
  }
  if (data === true) {
    to.push("true");
    return;
  }
  if (data === false) {
    to.push("false");
    return;
  }
  switch (typeof data) {
    case "number": {
      if (!Number.isInteger(data)) {
        reportError2("floats are not supported", data);
      }
      to.push(data.toString());
      return;
    }
    case "bigint": {
      to.push(data.toString());
      return;
    }
    case "string": {
      to.push(JSON.stringify(data));
      return;
    }
    case "object": {
      if (data instanceof Uint8Array) {
        to.push("b#");
        for (const b of data) {
          to.push(b.toString(16));
        }
      } else if (data instanceof Array) {
        to.push("[");
        for (const c of data) {
          toStringImpl(c, to);
          to.push(",");
        }
        to.push("]");
      } else if (data instanceof Map) {
        toStringImplMap(data.entries(), to);
      } else if (data instanceof _chunkFKFYEOS7cjs.CalldataAddress) {
        to.push("addr#");
        for (const c of data.bytes) {
          to.push(c.toString(16));
        }
      } else if (Object.getPrototypeOf(data) === Object.prototype) {
        toStringImplMap(Object.entries(data), to);
      } else {
        reportError2("unknown object type", data);
      }
      return;
    }
    default:
      reportError2("unknown base type", data);
  }
}
function toString(data) {
  const to = [];
  toStringImpl(data, to);
  return to.join("");
}

// src/abi/transactions.ts
var transactions_exports = {};
_chunk75ZPJI57cjs.__export.call(void 0, transactions_exports, {
  serialize: () => serialize,
  serializeOne: () => serializeOne
});

function serializeOne(data) {
  return _viem.toHex.call(void 0, data);
}
function serialize(data) {
  return _viem.toRlp.call(void 0, data.map(serializeOne));
}

// src/abi/nftMinter.ts
var ADDRESS_MANAGER_ABI = [
  {
    inputs: [{ internalType: "string", name: "key", type: "string" }],
    name: "getAddressNonZero",
    outputs: [{ internalType: "address", name: "addr", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];
var NFT_MINTER_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "nftId", type: "uint256" },
      { internalType: "uint256", name: "numberOfEpochsToClaim", type: "uint256" }
    ],
    name: "claimEpochs",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "developer", type: "address" }],
    name: "developerToNFT",
    outputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "getClaimableRewardsFromFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "nftId", type: "uint256" },
      { internalType: "uint256", name: "numberOfEpochsToClaim", type: "uint256" }
    ],
    name: "getClaimableRewardsFromInflation",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "getGhostsForNFT",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "getLastClaimedEpoch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "getNumberOfEpochsToClaim",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "developer", type: "address" }],
    name: "hasNFT",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "nftId", type: "uint256" }],
    name: "nfts",
    outputs: [
      { internalType: "address", name: "developer", type: "address" },
      { internalType: "uint256", name: "claimableRewards", type: "uint256" },
      { internalType: "uint256", name: "lastClaimedEpoch", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
];

// src/contracts/actions.ts


// src/abi/index.ts
var abi_exports = {};
_chunk75ZPJI57cjs.__export.call(void 0, abi_exports, {
  ADDRESS_MANAGER_ABI: () => ADDRESS_MANAGER_ABI2,
  CONSENSUS_ADDRESS_MANAGER_ABI: () => CONSENSUS_ADDRESS_MANAGER_ABI,
  NFT_MINTER_ABI: () => NFT_MINTER_ABI,
  STAKING_ABI: () => _chunkNUO3HSVBcjs.STAKING_ABI,
  VALIDATOR_WALLET_ABI: () => _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
  VESTING_ABI: () => VESTING_ABI,
  VESTING_FACTORY_ABI: () => VESTING_FACTORY_ABI,
  calldata: () => calldata,
  transactions: () => transactions
});

// src/abi/vesting.ts
var CONSENSUS_ADDRESS_MANAGER_ABI = [
  {
    name: "getAddressManager",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
];
var ADDRESS_MANAGER_ABI2 = [
  { name: "ZeroAddress", type: "error", inputs: [{ name: "key", type: "string" }] },
  { name: "ArrayLengthMismatch", type: "error", inputs: [] },
  {
    name: "AddressUpdated",
    type: "event",
    inputs: [
      { name: "key", type: "string", indexed: true },
      { name: "oldAddr", type: "address", indexed: true },
      { name: "newAddr", type: "address", indexed: true }
    ]
  },
  { name: "getAddress", type: "function", stateMutability: "view", inputs: [{ name: "key", type: "string" }], outputs: [{ name: "", type: "address" }] },
  { name: "getAddressNonZero", type: "function", stateMutability: "view", inputs: [{ name: "key", type: "string" }], outputs: [{ name: "", type: "address" }] },
  { name: "addressBook", type: "function", stateMutability: "view", inputs: [{ name: "key", type: "string" }], outputs: [{ name: "", type: "address" }] },
  {
    name: "getAllContractAddresses",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "tuple[]", components: [{ name: "key", type: "string" }, { name: "addr", type: "address" }] }]
  },
  { name: "getContractKeyCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }
];
var VESTING_ABI = [
  { name: "NotBeneficiary", type: "error", inputs: [] },
  { name: "NotRevoker", type: "error", inputs: [] },
  { name: "NotCreator", type: "error", inputs: [] },
  { name: "NotRevocable", type: "error", inputs: [] },
  { name: "AlreadyRevoked", type: "error", inputs: [] },
  { name: "NotRevoked", type: "error", inputs: [] },
  { name: "AlreadyUnlocked", type: "error", inputs: [] },
  { name: "ManualUnlockNotRequired", type: "error", inputs: [] },
  { name: "WithdrawExceedsVested", type: "error", inputs: [] },
  { name: "InsufficientContractBalance", type: "error", inputs: [] },
  { name: "ZeroAmount", type: "error", inputs: [] },
  { name: "TransferFailed", type: "error", inputs: [] },
  { name: "VestingAlreadyStopped", type: "error", inputs: [] },
  { name: "VestingNotStopped", type: "error", inputs: [] },
  { name: "InvalidStopTimestamp", type: "error", inputs: [] },
  { name: "NoValidatorWallet", type: "error", inputs: [] },
  { name: "InvalidAddress", type: "error", inputs: [] },
  { name: "VestingAlreadyExists", type: "error", inputs: [] },
  { name: "VestingDeploymentFailed", type: "error", inputs: [] },
  { name: "BeaconNotDeployed", type: "error", inputs: [] },
  { name: "BeaconAlreadyDeployed", type: "error", inputs: [] },
  { name: "FundingMismatch", type: "error", inputs: [] },
  { name: "InvalidCliffUnlockBps", type: "error", inputs: [] },
  { name: "InvalidPeriodDuration", type: "error", inputs: [] },
  {
    name: "VestingInitialized",
    type: "event",
    inputs: [
      { name: "name", type: "string", indexed: false },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "startDate", type: "uint256", indexed: false },
      { name: "category", type: "uint8", indexed: false }
    ]
  },
  { name: "TokensWithdrawn", type: "event", inputs: [{ name: "beneficiary", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "DelegatorJoined", type: "event", inputs: [{ name: "validator", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "DelegatorExited", type: "event", inputs: [{ name: "validator", type: "address", indexed: true }, { name: "shares", type: "uint256", indexed: false }] },
  { name: "DelegatorClaimed", type: "event", inputs: [{ name: "validator", type: "address", indexed: true }, { name: "returned", type: "uint256", indexed: false }, { name: "rewardOrLoss", type: "int256", indexed: false }] },
  { name: "ValidatorJoined", type: "event", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "operator", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "ValidatorDeposited", type: "event", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "ValidatorExited", type: "event", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "shares", type: "uint256", indexed: false }] },
  { name: "ValidatorClaimed", type: "event", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "returned", type: "uint256", indexed: false }, { name: "rewardOrLoss", type: "int256", indexed: false }] },
  { name: "Revoked", type: "event", inputs: [{ name: "vestedAtRevocation", type: "uint256", indexed: false }, { name: "totalAmountAtRevocation", type: "uint256", indexed: false }] },
  { name: "VestingStopped", type: "event", inputs: [{ name: "stopTimestamp", type: "uint256", indexed: false }] },
  { name: "VestingResumed", type: "event", inputs: [] },
  { name: "ManuallyUnlocked", type: "event", inputs: [] },
  { name: "TopUp", type: "event", inputs: [{ name: "amount", type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
  { name: "FoundationSwept", type: "event", inputs: [{ name: "amount", type: "uint256", indexed: false }] },
  { name: "NameSet", type: "event", inputs: [{ name: "oldName", type: "string", indexed: false }, { name: "newName", type: "string", indexed: false }] },
  { name: "CategorySet", type: "event", inputs: [{ name: "oldCategory", type: "uint8", indexed: false }, { name: "newCategory", type: "uint8", indexed: false }] },
  { name: "StartDateSet", type: "event", inputs: [{ name: "oldStartDate", type: "uint256", indexed: false }, { name: "newStartDate", type: "uint256", indexed: false }] },
  { name: "CliffDurationSet", type: "event", inputs: [{ name: "oldCliffDuration", type: "uint256", indexed: false }, { name: "newCliffDuration", type: "uint256", indexed: false }] },
  { name: "PeriodDurationSet", type: "event", inputs: [{ name: "oldPeriodDuration", type: "uint256", indexed: false }, { name: "newPeriodDuration", type: "uint256", indexed: false }] },
  { name: "NumberOfPeriodsSet", type: "event", inputs: [{ name: "oldNumberOfPeriods", type: "uint256", indexed: false }, { name: "newNumberOfPeriods", type: "uint256", indexed: false }] },
  { name: "CliffUnlockBpsSet", type: "event", inputs: [{ name: "oldCliffUnlockBps", type: "uint256", indexed: false }, { name: "newCliffUnlockBps", type: "uint256", indexed: false }] },
  { name: "BeneficiarySet", type: "event", inputs: [{ name: "oldBeneficiary", type: "address", indexed: true }, { name: "newBeneficiary", type: "address", indexed: true }] },
  { name: "CreatorSet", type: "event", inputs: [{ name: "oldCreator", type: "address", indexed: true }, { name: "newCreator", type: "address", indexed: true }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "category", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "beneficiary", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "creator", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "revoker", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "factory", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "addressManager", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "totalAmount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "startDate", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "cliffDuration", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "periodDuration", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "numberOfPeriods", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "cliffUnlockBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "needsManualUnlock", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "manualUnlocked", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "revoked", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "vestingStopped", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "totalWithdrawn", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "vestedAtRevocation", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalAmountAtRevocation", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "revokedAt", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "vestingStoppedAt", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "vestedAtStop", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "postRevocationBeneficiaryRewards", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "postRevocationBeneficiaryLosses", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "depositedPerValidator", type: "function", stateMutability: "view", inputs: [{ name: "validator", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "pendingExitDeposited", type: "function", stateMutability: "view", inputs: [{ name: "validator", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "accumulatedRewards", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "accumulatedLosses", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "validatorWallets", type: "function", stateMutability: "view", inputs: [{ name: "index", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { name: "isValidatorWallet", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "validatorDeposited", type: "function", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getValidatorWallets", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address[]" }] },
  { name: "validatorWalletCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "vestedAmount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "unvestedAmount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "withdrawableAmount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "vestingWithdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "vestingDelegatorJoin", type: "function", stateMutability: "nonpayable", inputs: [{ name: "validator", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "vestingDelegatorExit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "validator", type: "address" }, { name: "shares", type: "uint256" }], outputs: [] },
  { name: "vestingDelegatorClaim", type: "function", stateMutability: "nonpayable", inputs: [{ name: "validator", type: "address" }], outputs: [] },
  {
    name: "vestingValidatorJoin",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorPubKey", type: "uint256[2]" },
      { name: "possessionProof", type: "bytes" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  { name: "vestingValidatorDeposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "vestingValidatorExit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }, { name: "shares", type: "uint256" }], outputs: [] },
  { name: "vestingValidatorClaim", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  { name: "vestingValidatorInitiateOperatorTransfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }, { name: "newOperator", type: "address" }], outputs: [] },
  { name: "vestingValidatorCompleteOperatorTransfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  { name: "vestingValidatorCancelOperatorTransfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  {
    name: "vestingValidatorSetIdentity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "moniker", type: "string" },
      { name: "logoUri", type: "string" },
      { name: "website", type: "string" },
      { name: "description", type: "string" },
      { name: "email", type: "string" },
      { name: "twitter", type: "string" },
      { name: "telegram", type: "string" },
      { name: "github", type: "string" },
      { name: "extraCid", type: "bytes" }
    ],
    outputs: []
  },
  { name: "revoke", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "stopVesting", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "resumeVesting", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "foundationSweep", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "manualUnlock", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "topUp", type: "function", stateMutability: "payable", inputs: [{ name: "reason", type: "string" }], outputs: [] },
  { name: "setName", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_name", type: "string" }], outputs: [] },
  { name: "setCategory", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_category", type: "uint8" }], outputs: [] },
  { name: "setStartDate", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_startDate", type: "uint256" }], outputs: [] },
  { name: "setCliffDuration", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_cliffDuration", type: "uint256" }], outputs: [] },
  { name: "setPeriodDuration", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_periodDuration", type: "uint256" }], outputs: [] },
  { name: "setNumberOfPeriods", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_numberOfPeriods", type: "uint256" }], outputs: [] },
  { name: "setCliffUnlockBps", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_cliffUnlockBps", type: "uint256" }], outputs: [] },
  { name: "setBeneficiary", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_beneficiary", type: "address" }], outputs: [] },
  { name: "setCreator", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_creator", type: "address" }], outputs: [] }
];
var VESTING_FACTORY_ABI = [
  { name: "InvalidAddress", type: "error", inputs: [] },
  { name: "VestingAlreadyExists", type: "error", inputs: [] },
  { name: "VestingDeploymentFailed", type: "error", inputs: [] },
  { name: "BeaconNotDeployed", type: "error", inputs: [] },
  { name: "BeaconAlreadyDeployed", type: "error", inputs: [] },
  { name: "FundingMismatch", type: "error", inputs: [] },
  { name: "InvalidCliffUnlockBps", type: "error", inputs: [] },
  { name: "InvalidPeriodDuration", type: "error", inputs: [] },
  { name: "ZeroAmount", type: "error", inputs: [] },
  { name: "OwnableUnauthorizedAccount", type: "error", inputs: [{ name: "account", type: "address" }] },
  { name: "OwnableInvalidOwner", type: "error", inputs: [{ name: "owner", type: "address" }] },
  { name: "VestingCreated", type: "event", inputs: [{ name: "beneficiary", type: "address", indexed: true }, { name: "vestingContract", type: "address", indexed: true }, { name: "totalAmount", type: "uint256", indexed: false }, { name: "category", type: "uint8", indexed: false }] },
  { name: "BeaconDeployed", type: "event", inputs: [{ name: "beacon", type: "address", indexed: true }, { name: "implementation", type: "address", indexed: true }] },
  { name: "BeaconUpgraded", type: "event", inputs: [{ name: "newImplementation", type: "address", indexed: true }] },
  { name: "VestingBlueprintSet", type: "event", inputs: [{ name: "blueprint", type: "address", indexed: true }] },
  { name: "INITIALIZE_SELECTOR", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes4" }] },
  { name: "addressManager", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "vestingBlueprint", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "vestingBeacon", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "beneficiaryToVesting", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "address" }] },
  { name: "isVestingContract", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "totalVestingsDeployed", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    name: "createVesting",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_beneficiary", type: "address" },
      { name: "_revoker", type: "address" },
      { name: "_startDate", type: "uint256" },
      { name: "_cliffDuration", type: "uint256" },
      { name: "_periodDuration", type: "uint256" },
      { name: "_numberOfPeriods", type: "uint256" },
      { name: "_cliffUnlockBps", type: "uint256" },
      { name: "_needsManualUnlock", type: "bool" },
      { name: "_totalAmount", type: "uint256" },
      { name: "_category", type: "uint8" }
    ],
    outputs: [{ name: "vestingContract", type: "address" }]
  },
  {
    name: "createBatchVesting",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "params", type: "tuple[]", components: [
      { name: "name", type: "string" },
      { name: "beneficiary", type: "address" },
      { name: "revoker", type: "address" },
      { name: "startDate", type: "uint256" },
      { name: "cliffDuration", type: "uint256" },
      { name: "periodDuration", type: "uint256" },
      { name: "numberOfPeriods", type: "uint256" },
      { name: "cliffUnlockBps", type: "uint256" },
      { name: "needsManualUnlock", type: "bool" },
      { name: "totalAmount", type: "uint256" },
      { name: "category", type: "uint8" }
    ] }],
    outputs: [{ name: "vestingContracts", type: "address[]" }]
  },
  { name: "deployNewBeacon", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "upgradeBeacon", type: "function", stateMutability: "nonpayable", inputs: [{ name: "newImplementation", type: "address" }], outputs: [] },
  { name: "setVestingBlueprint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_blueprint", type: "address" }], outputs: [] },
  { name: "setAddressManager", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_addressManager", type: "address" }], outputs: [] },
  { name: "getVesting", type: "function", stateMutability: "view", inputs: [{ name: "_beneficiary", type: "address" }], outputs: [{ name: "", type: "address" }] },
  { name: "getMyVestings", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address[]" }] },
  { name: "getMyVestingCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getAllVestings", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address[]" }] },
  { name: "getAllVestingsCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "isVestingAddress", type: "function", stateMutability: "view", inputs: [{ name: "_wallet", type: "address" }], outputs: [{ name: "", type: "bool" }] }
];

// src/abi/index.ts
var calldata = calldata_exports;
var transactions = transactions_exports;

// src/utils/jsonifier.ts

function b64ToArray(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function arrayToB64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function calldataToUserFriendlyJson(cd) {
  return {
    raw: Array.from(cd),
    readable: calldata.toString(calldata.decode(cd))
  };
}
var RESULT_CODES = /* @__PURE__ */ new Map([
  [0, "return"],
  [1, "rollback"],
  [2, "contract_error"],
  [3, "error"],
  [4, "none"],
  [5, "no_leaders"]
]);
function resultToUserFriendlyJson(cd64) {
  const raw = b64ToArray(cd64);
  const code = RESULT_CODES.get(raw[0]);
  let status;
  let payload = null;
  if (code === void 0) {
    status = "<unknown>";
  } else {
    status = code;
    if ([1, 2].includes(raw[0])) {
      payload = new TextDecoder("utf-8").decode(raw.slice(1));
    } else if (raw[0] == 0) {
      payload = calldataToUserFriendlyJson(raw.slice(1));
    }
  }
  return {
    raw: cd64,
    status,
    payload
  };
}
function toJsonSafeDeep(value) {
  return _toJsonSafeDeep(value, /* @__PURE__ */ new WeakSet());
}
function _toJsonSafeDeep(value, seen) {
  if (value === null || value === void 0) {
    return null;
  }
  const primitiveType = typeof value;
  if (primitiveType === "string" || primitiveType === "boolean" || primitiveType === "number") {
    return value;
  }
  if (primitiveType === "bigint") {
    const big = value;
    const abs = big < 0n ? -big : big;
    const maxSafe = 9007199254740991n;
    return abs <= maxSafe ? Number(big) : big.toString();
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);
    if (value instanceof Uint8Array) {
      return _viem.toHex.call(void 0, value);
    }
    if (value instanceof Array) {
      return value.map((v) => _toJsonSafeDeep(v, seen));
    }
    if (value instanceof Map) {
      const obj = {};
      for (const [k, v] of value.entries()) {
        obj[k] = _toJsonSafeDeep(v, seen);
      }
      return obj;
    }
    if (value instanceof _chunkFKFYEOS7cjs.CalldataAddress) {
      return _viem.toHex.call(void 0, value.bytes);
    }
    if (Object.getPrototypeOf(value) === Object.prototype) {
      const obj = {};
      for (const [k, v] of Object.entries(value)) {
        obj[k] = _toJsonSafeDeep(v, seen);
      }
      return obj;
    }
  }
  return value;
}

// src/transactions/fees.ts

var MESSAGE_ALLOCATION_ROOT_PARENT_INDEX = (1n << 256n) - 1n;
var CALL_KEY_WILDCARD = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
var CALL_KEY_UNNAMED = "0x0000000000000000000000000000000000000000000000000000000000000000";
var DEPLOY_CALL_KEY = CALL_KEY_UNNAMED;
var CALL_KEY_DEPLOY = DEPLOY_CALL_KEY;
var deployCallKey = () => DEPLOY_CALL_KEY;
var bytesToPaddedCallKey = (bytes) => {
  if (bytes.length > 32) {
    throw new Error("call key source bytes must be 32 bytes or fewer.");
  }
  return `0x${_viem.toHex.call(void 0, bytes).slice(2).padEnd(64, "0")}`;
};
var deriveInternalMessageCallKey = (methodName = "") => {
  const methodBytes = new TextEncoder().encode(methodName);
  if (methodBytes.length < 32) {
    return bytesToPaddedCallKey(methodBytes);
  }
  const hashed = _viem.keccak256.call(void 0, methodBytes);
  const lastByte = Number.parseInt(hashed.slice(-2), 16) | 1;
  return `${hashed.slice(0, -2)}${lastByte.toString(16).padStart(2, "0")}`;
};
var deriveExternalMessageCallKey = (selectorOrCalldata = "0x") => {
  const bytes = typeof selectorOrCalldata === "string" ? _viem.hexToBytes.call(void 0, selectorOrCalldata) : selectorOrCalldata;
  if (bytes.length < 4) {
    return CALL_KEY_UNNAMED;
  }
  return bytesToPaddedCallKey(bytes.slice(0, 4));
};
var DEFAULT_FEES_DISTRIBUTION = {
  leaderTimeunitsAllocation: 0n,
  validatorTimeunitsAllocation: 0n,
  appealRounds: 0n,
  executionBudgetPerRound: 0n,
  executionConsumed: 0n,
  totalMessageFees: 0n,
  rotations: [0n],
  maxPriceGenPerTimeUnit: 0n,
  storageFeeMaxGasPrice: 0n,
  receiptFeeMaxGasPrice: 0n
};
var toUInt = (value, fieldName, fallback = 0n) => {
  if (value === void 0) {
    return fallback;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be a safe integer when provided as a number.`);
  }
  const normalized = BigInt(value);
  if (normalized < 0n) {
    throw new Error(`${fieldName} must be greater than or equal to zero.`);
  }
  return normalized;
};
var normalizeRotations = (rotations, appealRounds, fieldName) => {
  const expectedLength = Number(appealRounds + 1n);
  if (!Number.isSafeInteger(expectedLength)) {
    throw new Error(`${fieldName} appealRounds is too large.`);
  }
  if (!rotations) {
    return Array.from({ length: expectedLength }, () => 0n);
  }
  const normalized = rotations.map((rotation, index) => toUInt(rotation, `${fieldName}[${index}]`));
  if (normalized.length !== expectedLength) {
    throw new Error(`${fieldName} must contain appealRounds + 1 entries.`);
  }
  return normalized;
};
var hasNonDefaultFeesDistribution = (distribution) => {
  return distribution.leaderTimeunitsAllocation !== 0n || distribution.validatorTimeunitsAllocation !== 0n || distribution.appealRounds !== 0n || distribution.executionBudgetPerRound !== 0n || distribution.executionConsumed !== 0n || distribution.totalMessageFees !== 0n || distribution.rotations.length !== 1 || distribution.rotations[0] !== 0n || distribution.maxPriceGenPerTimeUnit !== 0n || distribution.storageFeeMaxGasPrice !== 0n || distribution.receiptFeeMaxGasPrice !== 0n;
};
var createFeesDistribution = (input = {}) => {
  const appealRounds = toUInt(input.appealRounds, "fees.distribution.appealRounds");
  return {
    leaderTimeunitsAllocation: toUInt(input.leaderTimeunitsAllocation, "fees.distribution.leaderTimeunitsAllocation"),
    validatorTimeunitsAllocation: toUInt(input.validatorTimeunitsAllocation, "fees.distribution.validatorTimeunitsAllocation"),
    appealRounds,
    executionBudgetPerRound: toUInt(input.executionBudgetPerRound, "fees.distribution.executionBudgetPerRound"),
    executionConsumed: toUInt(input.executionConsumed, "fees.distribution.executionConsumed"),
    totalMessageFees: toUInt(input.totalMessageFees, "fees.distribution.totalMessageFees"),
    rotations: normalizeRotations(input.rotations, appealRounds, "fees.distribution.rotations"),
    maxPriceGenPerTimeUnit: toUInt(input.maxPriceGenPerTimeUnit, "fees.distribution.maxPriceGenPerTimeUnit"),
    storageFeeMaxGasPrice: toUInt(input.storageFeeMaxGasPrice, "fees.distribution.storageFeeMaxGasPrice"),
    receiptFeeMaxGasPrice: toUInt(input.receiptFeeMaxGasPrice, "fees.distribution.receiptFeeMaxGasPrice")
  };
};
var createTopUpFeesDistribution = (input = {}) => {
  const appealRounds = toUInt(input.appealRounds, "fees.distribution.appealRounds");
  let rotations;
  if (input.rotations === void 0 || input.rotations.length === 0) {
    if (appealRounds !== 0n) {
      throw new Error(
        "fees.distribution.rotations must contain appealRounds + 1 entries when appealRounds is non-zero."
      );
    }
    rotations = [];
  } else {
    rotations = normalizeRotations(input.rotations, appealRounds, "fees.distribution.rotations");
  }
  return {
    leaderTimeunitsAllocation: toUInt(input.leaderTimeunitsAllocation, "fees.distribution.leaderTimeunitsAllocation"),
    validatorTimeunitsAllocation: toUInt(input.validatorTimeunitsAllocation, "fees.distribution.validatorTimeunitsAllocation"),
    appealRounds,
    executionBudgetPerRound: toUInt(input.executionBudgetPerRound, "fees.distribution.executionBudgetPerRound"),
    executionConsumed: toUInt(input.executionConsumed, "fees.distribution.executionConsumed"),
    totalMessageFees: toUInt(input.totalMessageFees, "fees.distribution.totalMessageFees"),
    rotations,
    maxPriceGenPerTimeUnit: toUInt(input.maxPriceGenPerTimeUnit, "fees.distribution.maxPriceGenPerTimeUnit"),
    storageFeeMaxGasPrice: toUInt(input.storageFeeMaxGasPrice, "fees.distribution.storageFeeMaxGasPrice"),
    receiptFeeMaxGasPrice: toUInt(input.receiptFeeMaxGasPrice, "fees.distribution.receiptFeeMaxGasPrice")
  };
};
var encodeInternalMessageFeeParams = (input = {}) => {
  const appealRounds = toUInt(input.appealRounds, "internalMessageFeeParams.appealRounds");
  return _viem.encodeAbiParameters.call(void 0, 
    [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "leaderTimeunitsAllocation", type: "uint256" },
          { name: "validatorTimeunitsAllocation", type: "uint256" },
          { name: "appealRounds", type: "uint256" },
          { name: "executionBudgetPerRound", type: "uint256" },
          { name: "rotations", type: "uint256[]" },
          { name: "maxPriceGenPerTimeUnit", type: "uint256" },
          { name: "storageFeeMaxGasPrice", type: "uint256" },
          { name: "receiptFeeMaxGasPrice", type: "uint256" }
        ]
      }
    ],
    [
      {
        leaderTimeunitsAllocation: toUInt(input.leaderTimeunitsAllocation, "internalMessageFeeParams.leaderTimeunitsAllocation"),
        validatorTimeunitsAllocation: toUInt(input.validatorTimeunitsAllocation, "internalMessageFeeParams.validatorTimeunitsAllocation"),
        appealRounds,
        executionBudgetPerRound: toUInt(input.executionBudgetPerRound, "internalMessageFeeParams.executionBudgetPerRound"),
        rotations: normalizeRotations(input.rotations, appealRounds, "internalMessageFeeParams.rotations"),
        maxPriceGenPerTimeUnit: toUInt(input.maxPriceGenPerTimeUnit, "internalMessageFeeParams.maxPriceGenPerTimeUnit"),
        storageFeeMaxGasPrice: toUInt(input.storageFeeMaxGasPrice, "internalMessageFeeParams.storageFeeMaxGasPrice"),
        receiptFeeMaxGasPrice: toUInt(input.receiptFeeMaxGasPrice, "internalMessageFeeParams.receiptFeeMaxGasPrice")
      }
    ]
  );
};
var encodeExternalMessageFeeParams = (input = {}) => {
  return _viem.encodeAbiParameters.call(void 0, 
    [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "gasLimit", type: "uint256" },
          { name: "maxGasPrice", type: "uint256" }
        ]
      }
    ],
    [
      {
        gasLimit: toUInt(input.gasLimit, "externalMessageFeeParams.gasLimit"),
        maxGasPrice: toUInt(input.maxGasPrice, "externalMessageFeeParams.maxGasPrice")
      }
    ]
  );
};
var normalizeMessageFeeAllocations = (allocations = []) => {
  return allocations.map((allocation, index) => ({
    messageType: allocation.messageType,
    onAcceptance: _nullishCoalesce(allocation.onAcceptance, () => ( allocation.messageType !== 0)) /* External */,
    parentIndex: toUInt(
      allocation.parentIndex,
      `fees.messageAllocations[${index}].parentIndex`,
      MESSAGE_ALLOCATION_ROOT_PARENT_INDEX
    ),
    recipient: allocation.recipient,
    callKey: _nullishCoalesce(allocation.callKey, () => ( CALL_KEY_WILDCARD)),
    budget: toUInt(allocation.budget, `fees.messageAllocations[${index}].budget`),
    feeParams: _nullishCoalesce(allocation.feeParams, () => ( "0x"))
  }));
};
var normalizeTransactionFees = (fees) => {
  const distribution = createFeesDistribution(_optionalChain([fees, 'optionalAccess', _5 => _5.distribution]));
  const messageAllocations = normalizeMessageFeeAllocations(_optionalChain([fees, 'optionalAccess', _6 => _6.messageAllocations]));
  const feeValue = _optionalChain([fees, 'optionalAccess', _7 => _7.feeValue]) === void 0 ? void 0 : toUInt(fees.feeValue, "fees.feeValue");
  return {
    distribution,
    messageAllocations,
    feeValue,
    requiresFeeAwareTransaction: hasNonDefaultFeesDistribution(distribution) || messageAllocations.length > 0 || (_nullishCoalesce(feeValue, () => ( 0n))) !== 0n
  };
};

// src/abi/consensusTrain.ts

var parseTrainAbi = _viem.parseAbi;
var CONSENSUS_DATA_TRAIN_ABI = parseTrainAbi([
  "function addressManager() view returns (address)",
  "function getTransactionLifecycle(bytes32 _txId, uint256 _timestamp) view returns ((uint8 storedStatus, (bytes32 txId, uint8 storedStatus, uint8 projectedStatus, uint8 action, uint8 result, bytes32 resultHash, uint8 source, uint256 sourceRound, uint256 sourceGeneration, bytes32 sourceRoundContextHash, bytes32 roundPlanHash, uint256 resultRound, uint256 resultGeneration, uint256 basisDecisionId, uint8 context, bytes32 attemptId, uint256 boundaryAt, uint256 evaluatedAt, uint256 snapshotBlock, uint256 decisionWindow, uint256 appealDeadline, bool materializesDecision, bool actionOutcomeDeterministic, bool nonCurrentEvaluation) resolution, (bool exists, uint256 decisionId, uint256 basisDecisionId, uint8 context, uint8 source, bytes32 sourceAttemptId, uint8 sourceStatus, uint8 status, uint256 sourceRound, uint256 sourceGeneration, bytes32 sourceRoundContextHash, bytes32 roundPlanHash, uint256 resultRound, uint256 resultGeneration, uint8 result, bytes32 resultHash, uint256 effectiveAt, uint256 materializedAt, uint256 appealDeadline) latestDecision, bool decisionActive) lifecycle)",
  "function estimateLatestAppealCharge(bytes32 _txId) view returns (uint256 decisionId, uint256 bond, uint256 funding, uint256 appealDeadline)"
]);
var ADDRESS_MANAGER_TRAIN_ABI = parseTrainAbi([
  "function getAddress(string _name) view returns (address)"
]);
var CONSENSUS_DATA_BIG_ROUNDS_TRAIN_ABI = parseTrainAbi([
  "function getStoredTransactionDataLight(bytes32 _txId) view returns ((uint256 observedAt, address sender, address recipient, uint256 initialRotations, uint256 txSlot, uint256 createdTimestamp, uint256 lastVoteTimestamp, bytes32 randomSeed, uint8 result, bytes32 txExecutionHash, bytes txCalldata, bytes eqBlocksOutputs, (uint8 messageType, address recipient, uint256 value, bytes data, bool onAcceptance, uint256 saltNonce, bytes feeParams, uint256 declaredBudget, bytes allocationSubtree, bytes32 callKey, bool useBalance)[] messages, uint8 queueType, uint256 queuePosition, address activator, address lastLeader, uint8 status, bytes32 txId, (uint256 activationBlock, uint256 processingBlock, uint256 proposalBlock) readStateBlockRange, uint256 numOfRounds, (uint256 round, uint256 leaderIndex, uint256 votesCommitted, uint256 votesRevealed, uint256 appealBond, uint256 rotationsLeft, uint8 result, uint256 validatorsCount) lastRound, uint256 consumedValidatorsCount) transaction)",
  "function getRoundValidatorsPaged(bytes32 _txId, uint256 _round, uint256 _offset, uint256 _limit) view returns (address[] page, uint256 total)",
  "function getConsumedValidatorsPaged(bytes32 _txId, uint256 _offset, uint256 _limit) view returns (address[] page, uint256 total)"
]);
var ROUNDS_STORAGE_TRAIN_READ_ABI = parseTrainAbi([
  "function getRoundNumber(bytes32 txId) view returns (uint256)",
  "function getLeaderIndex(bytes32 txId, uint256 round) view returns (uint256)",
  "function getVotesCommitted(bytes32 txId, uint256 round) view returns (uint256)",
  "function getVotesRevealed(bytes32 txId, uint256 round) view returns (uint256)",
  "function getAppealBond(bytes32 txId, uint256 round) view returns (uint256)",
  "function getRotationsLeft(bytes32 txId, uint256 round) view returns (uint256)",
  "function getResult(bytes32 txId, uint256 round) view returns (uint8)",
  "function getRoundValidatorsPage(bytes32 txId, uint256 round, uint256 offset, uint256 pageSize) view returns (address[] validators, uint256 total)",
  "function getValidatorVotes(bytes32 txId, uint256 round) view returns (uint8[] votes)",
  "function getValidatorVotesHash(bytes32 txId, uint256 round) view returns (bytes32[] hashes)",
  "function getValidatorResultHash(bytes32 txId, uint256 round) view returns (bytes32[] hashes)"
]);
var TRANSACTION_MANAGER_TRAIN_READ_ABI = parseTrainAbi([
  "function getTxExecutionResult(bytes32 txId) view returns (uint8)",
  "function getNumOfInitialValidators(bytes32 txId) view returns (uint256)"
]);

// src/contracts/actions.ts
var prefixHex = (hex) => {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
};
function extractGenCallResult(result) {
  if (typeof result === "string") {
    return prefixHex(result);
  }
  if (result && typeof result === "object" && "data" in result) {
    const obj = result;
    if (obj.status && obj.status.code !== 0) {
      throw new Error(`gen_call failed: ${obj.status.message}`);
    }
    return prefixHex(obj.data);
  }
  if (result && typeof result === "object" && "result" in result) {
    const obj = result;
    if (obj.execution_result && obj.execution_result !== "SUCCESS") {
      throw new Error(`sim_call failed: ${obj.execution_result}`);
    }
    if (typeof obj.result === "string" && obj.result.startsWith("0x")) {
      return prefixHex(obj.result);
    }
    const resultBytes = b64ToArray(obj.result);
    if (resultBytes.length === 0) {
      throw new Error("sim_call returned an empty result payload");
    }
    return _viem.toHex.call(void 0, resultBytes.slice(1));
  }
  throw new Error(`Unexpected simulation response: ${JSON.stringify(result)}`);
}
function normalizeGenCallReceipt(result, data) {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result;
  }
  return { data };
}
function extractGenCallFeeAccounting(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return void 0;
  const genvmResult = result.genvm_result;
  if (!genvmResult || typeof genvmResult !== "object" || Array.isArray(genvmResult)) return void 0;
  const feeAccounting = genvmResult.fee_accounting;
  if (!feeAccounting || typeof feeAccounting !== "object" || Array.isArray(feeAccounting)) return void 0;
  return feeAccounting;
}
function extractGenCallFeeReport(feeAccounting) {
  const report = _optionalChain([feeAccounting, 'optionalAccess', _8 => _8.execution_fee_report]);
  if (!report || typeof report !== "object" || Array.isArray(report)) return void 0;
  return report;
}
function transactionFeesToRpc(fees) {
  if (!fees) return void 0;
  const normalized = normalizeTransactionFees(fees);
  return {
    distribution: {
      leaderTimeunitsAllocation: normalized.distribution.leaderTimeunitsAllocation.toString(),
      validatorTimeunitsAllocation: normalized.distribution.validatorTimeunitsAllocation.toString(),
      appealRounds: normalized.distribution.appealRounds.toString(),
      executionBudgetPerRound: normalized.distribution.executionBudgetPerRound.toString(),
      executionConsumed: normalized.distribution.executionConsumed.toString(),
      totalMessageFees: normalized.distribution.totalMessageFees.toString(),
      rotations: normalized.distribution.rotations.map((rotation) => rotation.toString()),
      maxPriceGenPerTimeUnit: normalized.distribution.maxPriceGenPerTimeUnit.toString(),
      storageFeeMaxGasPrice: normalized.distribution.storageFeeMaxGasPrice.toString(),
      receiptFeeMaxGasPrice: normalized.distribution.receiptFeeMaxGasPrice.toString()
    },
    messageAllocations: normalized.messageAllocations.map((allocation) => ({
      messageType: allocation.messageType,
      onAcceptance: allocation.onAcceptance,
      parentIndex: allocation.parentIndex.toString(),
      recipient: allocation.recipient,
      callKey: allocation.callKey,
      budget: allocation.budget.toString(),
      feeParams: allocation.feeParams
    })),
    ...normalized.feeValue === void 0 ? {} : { feeValue: normalized.feeValue.toString() }
  };
}
var contractActions = (client, publicClient) => {
  const estimateFeeValue = async (distribution, policy) => {
    if (_optionalChain([client, 'access', _9 => _9.chain, 'access', _10 => _10.feeManagerContract, 'optionalAccess', _11 => _11.address])) {
      const roundFees = await publicClient.readContract({
        address: client.chain.feeManagerContract.address,
        abi: FEE_MANAGER_CALCULATE_ROUND_FEES_ABI,
        functionName: "calculateRoundFees",
        args: [
          distribution,
          BigInt(client.chain.defaultNumberOfInitialValidators),
          0n
        ]
      });
      return roundFees + distribution.totalMessageFees;
    }
    if (client.chain.isStudio) {
      const studioPolicy = await _asyncNullishCoalesce(policy, async () => ( await readCurrentFeePolicy(client, publicClient)));
      return calculateLocalRoundFees(
        distribution,
        client.chain.defaultNumberOfInitialValidators,
        studioPolicy
      ) + distribution.totalMessageFees;
    }
    throw new Error("Fee value estimation is not supported on this chain (missing feeManagerContract).");
  };
  return {
    /** Retrieves the source code of a deployed contract. */
    getContractCode: async (address) => {
      const params = client.chain.isStudio ? [address] : [{ address }];
      const result = await client.request({
        method: "gen_getContractCode",
        params
      });
      const codeBytes = b64ToArray(result);
      return new TextDecoder().decode(codeBytes);
    },
    /** Gets the schema (methods and constructor) of a deployed contract. */
    getContractSchema: async (address) => {
      if (client.chain.isStudio) {
        const schema2 = await client.request({
          method: "gen_getContractSchema",
          params: [address]
        });
        return schema2;
      }
      const codeB64 = await client.request({
        method: "gen_getContractCode",
        params: [{ address }]
      });
      const schema = await client.request({
        method: "gen_getContractSchema",
        params: [{ code: codeB64 }]
      });
      return schema;
    },
    /** Generates a schema for contract code without deploying it. */
    getContractSchemaForCode: async (contractCode) => {
      if (client.chain.isStudio) {
        const schema2 = await client.request({
          method: "gen_getContractSchemaForCode",
          params: [_viem.toHex.call(void 0, contractCode)]
        });
        return schema2;
      }
      const bytes = typeof contractCode === "string" ? new TextEncoder().encode(contractCode) : contractCode;
      const codeB64 = arrayToB64(bytes);
      const schema = await client.request({
        method: "gen_getContractSchema",
        params: [{ code: codeB64 }]
      });
      return schema;
    },
    /** Executes a read-only contract call without modifying state. */
    readContract: async (args) => {
      const {
        account,
        address,
        functionName,
        args: callArgs,
        kwargs,
        jsonSafeReturn = true,
        leaderOnly = false,
        transactionHashVariant = "latest-nonfinal" /* LATEST_NONFINAL */
      } = args;
      const encodedData = [encode(makeCalldataObject(functionName, callArgs, kwargs)), leaderOnly];
      const serializedData = serialize(encodedData);
      const senderAddress = _nullishCoalesce(_nullishCoalesce(_optionalChain([account, 'optionalAccess', _12 => _12.address]), () => ( _optionalChain([client, 'access', _13 => _13.account, 'optionalAccess', _14 => _14.address]))), () => ( _viem.zeroAddress));
      const requestParams = {
        type: "read",
        to: address,
        from: senderAddress,
        data: serializedData,
        transaction_hash_variant: transactionHashVariant
      };
      const result = await client.request({
        method: "gen_call",
        params: [requestParams]
      });
      const prefixedResult = extractGenCallResult(result);
      if (args.rawReturn) {
        return prefixedResult;
      }
      const resultBinary = _viem.fromHex.call(void 0, prefixedResult, "bytes");
      const decoded = decode(resultBinary);
      if (!jsonSafeReturn) {
        return decoded;
      }
      return toJsonSafeDeep(decoded);
    },
    /** Simulates a state-modifying contract call without executing on-chain. */
    simulateWriteContract: async (args) => {
      const {
        account,
        address,
        functionName,
        args: callArgs,
        kwargs,
        value,
        fees,
        leaderOnly = false,
        transactionHashVariant = "latest-nonfinal" /* LATEST_NONFINAL */
      } = args;
      const encodedData = [encode(makeCalldataObject(functionName, callArgs, kwargs)), leaderOnly];
      const serializedData = serialize(encodedData);
      const senderAddress = _nullishCoalesce(_nullishCoalesce(_optionalChain([account, 'optionalAccess', _15 => _15.address]), () => ( _optionalChain([client, 'access', _16 => _16.account, 'optionalAccess', _17 => _17.address]))), () => ( _viem.zeroAddress));
      const requestParams = {
        type: "write",
        to: address,
        from: senderAddress,
        data: serializedData,
        transaction_hash_variant: transactionHashVariant
      };
      const userValue = toUInt2(value, "value", 0n);
      if (userValue > 0n) {
        requestParams.value = _viem.toHex.call(void 0, userValue);
      }
      const rpcFees = transactionFeesToRpc(fees);
      if (rpcFees) {
        requestParams.fees = rpcFees;
      }
      const simulationMethod = args.includeReceipt && client.chain.isStudio ? "sim_call" : "gen_call";
      const result = await client.request({
        method: simulationMethod,
        params: [requestParams]
      });
      const prefixedResult = extractGenCallResult(result);
      let decodedResult;
      if (args.rawReturn) {
        decodedResult = prefixedResult;
      } else {
        const resultBinary = _viem.fromHex.call(void 0, prefixedResult, "bytes");
        decodedResult = decode(resultBinary);
      }
      if (args.includeReceipt) {
        const feeAccounting = extractGenCallFeeAccounting(result);
        return {
          result: decodedResult,
          receipt: normalizeGenCallReceipt(result, prefixedResult),
          feeAccounting,
          feeReport: extractGenCallFeeReport(feeAccounting)
        };
      }
      return decodedResult;
    },
    /** Executes a state-modifying function on a contract through consensus. Returns the transaction hash. */
    writeContract: async (args) => {
      const {
        account,
        address,
        functionName,
        args: callArgs,
        kwargs,
        value = 0n,
        leaderOnly = false,
        consensusMaxRotations = client.chain.defaultConsensusMaxRotations,
        validUntil,
        fees
      } = args;
      const data = [encode(makeCalldataObject(functionName, callArgs, kwargs)), leaderOnly];
      const serializedData = serialize(data);
      const senderAccount = account || client.account;
      const transactionFees = await _resolveTransactionFees({
        client,
        publicClient,
        fees,
        numOfInitialValidators: client.chain.defaultNumberOfInitialValidators
      });
      const transactionVariants = _encodeAddTransactionData({
        client,
        senderAccount,
        recipient: address,
        data: serializedData,
        consensusMaxRotations,
        validUntil,
        userValue: value,
        transactionFees
      });
      return _sendTransaction({
        client,
        publicClient,
        transactionVariants,
        senderAccount
      });
    },
    /** Deploys a new intelligent contract to GenLayer. Returns the transaction hash. */
    deployContract: async (args) => {
      const {
        account,
        code,
        args: constructorArgs,
        kwargs,
        leaderOnly = false,
        consensusMaxRotations = client.chain.defaultConsensusMaxRotations,
        validUntil,
        fees
      } = args;
      const data = [
        code,
        encode(makeCalldataObject(void 0, constructorArgs, kwargs)),
        leaderOnly
      ];
      const serializedData = serialize(data);
      const senderAccount = account || client.account;
      const transactionFees = await _resolveTransactionFees({
        client,
        publicClient,
        fees,
        numOfInitialValidators: client.chain.defaultNumberOfInitialValidators
      });
      const transactionVariants = _encodeAddTransactionData({
        client,
        senderAccount,
        recipient: _viem.zeroAddress,
        data: serializedData,
        consensusMaxRotations,
        validUntil,
        userValue: 0n,
        transactionFees
      });
      return _sendTransaction({
        client,
        publicClient,
        transactionVariants,
        senderAccount
      });
    },
    /** Returns the active fee price policy used to build user-side caps. */
    getCurrentFeePolicy: async () => {
      return readCurrentFeePolicy(client, publicClient);
    },
    /**
     * Builds a fee distribution with caps derived from the active fee policy.
     * Omitted rotations fund the chain's configured consensus maximum.
     */
    estimateFeesDistribution: async (args) => {
      const policy = await readCurrentFeePolicy(client, publicClient);
      return buildEstimatedFeesDistribution(
        args,
        policy,
        client.chain.defaultConsensusMaxRotations
      );
    },
    /**
     * Builds a complete transaction `fees` object, including feeValue.
     * Studio has no on-chain FeeManager in the chain definition, so this uses
     * the same deterministic round-fee math as Studio trusted mode there.
     */
    estimateTransactionFees: async (args) => {
      const policy = await readCurrentFeePolicy(client, publicClient);
      const distribution = buildEstimatedFeesDistribution(
        args,
        policy,
        client.chain.defaultConsensusMaxRotations
      );
      return {
        distribution,
        messageAllocations: _optionalChain([args, 'optionalAccess', _18 => _18.messageAllocations]),
        feeValue: await estimateFeeValue(distribution, policy),
        policy
      };
    },
    /**
     * Builds a trusted fee preset from a representative Studio simulation.
     * This turns the returned fee accounting/report into execution and message
     * budgets while preserving mode-2 message allocations when the simulation
     * was run with them.
     */
    estimateTransactionFeesFromSimulation: async (args) => {
      const policy = await readCurrentFeePolicy(client, publicClient);
      const { estimateOptions, observed, messageAllocations } = buildEstimatedFeesOptionsFromSimulation(args, policy);
      const distribution = buildEstimatedFeesDistribution(
        estimateOptions,
        policy,
        client.chain.defaultConsensusMaxRotations
      );
      return {
        distribution,
        messageAllocations,
        feeValue: await estimateFeeValue(distribution, policy),
        policy,
        observed
      };
    },
    /**
     * Builds a trusted fee preset for a concrete write call in one step.
     * The method first gives the simulation a baseline fee budget, then uses
     * the returned Studio/GenVM fee accounting to derive the preset the dapp
     * should pass with the real transaction.
     */
    estimateTransactionFeesForWrite: async (args) => {
      const {
        account,
        address,
        functionName,
        args: callArgs,
        kwargs,
        value,
        leaderOnly = false,
        transactionHashVariant = "latest-nonfinal" /* LATEST_NONFINAL */,
        executionHeadroomBps,
        messageHeadroomBps,
        ...feeOptions
      } = args;
      const policy = await readCurrentFeePolicy(client, publicClient);
      const initialDistribution = buildEstimatedFeesDistribution(
        feeOptions,
        policy,
        client.chain.defaultConsensusMaxRotations
      );
      const initialEstimate = {
        distribution: initialDistribution,
        messageAllocations: feeOptions.messageAllocations,
        feeValue: await estimateFeeValue(initialDistribution, policy),
        policy
      };
      const encodedData = [
        encode(makeCalldataObject(functionName, callArgs, kwargs)),
        leaderOnly
      ];
      const serializedData = serialize(encodedData);
      const senderAddress = _nullishCoalesce(_nullishCoalesce(_optionalChain([account, 'optionalAccess', _19 => _19.address]), () => ( _optionalChain([client, 'access', _20 => _20.account, 'optionalAccess', _21 => _21.address]))), () => ( _viem.zeroAddress));
      const requestParams = {
        type: "write",
        to: address,
        from: senderAddress,
        data: serializedData,
        transaction_hash_variant: transactionHashVariant
      };
      const userValue = toUInt2(value, "value", 0n);
      if (userValue > 0n) {
        requestParams.value = _viem.toHex.call(void 0, userValue);
      }
      const rpcFees = transactionFeesToRpc({
        distribution: initialEstimate.distribution,
        messageAllocations: initialEstimate.messageAllocations,
        feeValue: initialEstimate.feeValue
      });
      if (rpcFees) {
        requestParams.fees = rpcFees;
      }
      if (client.chain.isStudio) {
        const studioEstimate = await client.request({
          method: "sim_estimateTransactionFees",
          params: [requestParams]
        });
        const authoritativeEstimate = transactionFeeEstimateFromStudioEstimate(
          studioEstimate,
          policy
        );
        if (authoritativeEstimate) {
          return authoritativeEstimate;
        }
      }
      const simulationResult = await client.request({
        method: "gen_call",
        params: [requestParams]
      });
      extractGenCallResult(simulationResult);
      const feeAccounting = extractGenCallFeeAccounting(simulationResult);
      const simulation = {
        feeAccounting,
        feeReport: extractGenCallFeeReport(feeAccounting)
      };
      const { estimateOptions, observed, messageAllocations } = buildEstimatedFeesOptionsFromSimulation(
        {
          ...feeOptions,
          executionHeadroomBps,
          messageHeadroomBps,
          simulation
        },
        policy
      );
      const distribution = buildEstimatedFeesDistribution(
        estimateOptions,
        policy,
        client.chain.defaultConsensusMaxRotations
      );
      return {
        distribution,
        messageAllocations,
        feeValue: await estimateFeeValue(distribution, policy),
        policy,
        observed
      };
    },
    /** Returns the full authoritative appeal charge (bond plus appeal funding). */
    getAppealCharge: async (args) => {
      const context = await _readAppealContext({ client, publicClient, txId: args.txId });
      return context.requiredValue;
    },
    /** @deprecated Use getAppealCharge. This legacy name also returns bond plus appeal funding. */
    getMinAppealBond: async (args) => {
      const context = await _readAppealContext({ client, publicClient, txId: args.txId });
      return context.requiredValue;
    },
    /** Returns the current consensus round number for a transaction. */
    getRoundNumber: async (args) => {
      if (!_optionalChain([client, 'access', _22 => _22.chain, 'access', _23 => _23.roundsStorageContract, 'optionalAccess', _24 => _24.address])) {
        throw new Error("getRoundNumber not supported on this chain (missing roundsStorageContract)");
      }
      return publicClient.readContract({
        address: client.chain.roundsStorageContract.address,
        abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
        functionName: "getRoundNumber",
        args: [args.txId]
      });
    },
    /** Returns detailed data for a specific consensus round. */
    getRoundData: async (args) => {
      if (!_optionalChain([client, 'access', _25 => _25.chain, 'access', _26 => _26.roundsStorageContract, 'optionalAccess', _27 => _27.address])) {
        throw new Error("getRoundData not supported on this chain (missing roundsStorageContract)");
      }
      const snapshot = await publicClient.getBlock();
      return _readRoundDataSnapshot({
        publicClient,
        address: client.chain.roundsStorageContract.address,
        txId: args.txId,
        round: args.round,
        blockNumber: snapshot.number
      });
    },
    /** Returns the current round number and its data for a transaction. */
    getLastRoundData: async (args) => {
      if (!_optionalChain([client, 'access', _28 => _28.chain, 'access', _29 => _29.roundsStorageContract, 'optionalAccess', _30 => _30.address])) {
        throw new Error("getLastRoundData not supported on this chain (missing roundsStorageContract)");
      }
      const snapshot = await publicClient.getBlock();
      const address = client.chain.roundsStorageContract.address;
      const round = await publicClient.readContract({
        address,
        abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
        functionName: "getRoundNumber",
        args: [args.txId],
        blockNumber: snapshot.number
      });
      const roundData = await _readRoundDataSnapshot({
        publicClient,
        address,
        txId: args.txId,
        round,
        blockNumber: snapshot.number
      });
      return Object.assign(
        [round, roundData],
        { round, roundData }
      );
    },
    /** Checks if a transaction can be appealed. */
    canAppeal: async (args) => {
      if (client.chain.isStudio) {
        const context2 = await _readLifecycleIdentity({ client, publicClient, txId: args.txId });
        if (!context2.decisionActive) return false;
        try {
          const quote = await client.request({
            method: "gen_estimateLatestAppealCharge",
            params: [{ txId: args.txId }]
          });
          return BigInt(String(quote.decisionId)) === context2.decisionId;
        } catch (error) {
          if (/CanNotAppeal/i.test(String(error))) return false;
          throw error;
        }
      }
      if (!_optionalChain([client, 'access', _31 => _31.chain, 'access', _32 => _32.appealsContract, 'optionalAccess', _33 => _33.address])) {
        throw new Error("canAppeal not supported on this chain (missing appealsContract)");
      }
      const context = await _readLifecycleIdentity({ client, publicClient, txId: args.txId });
      if (!context.decisionActive) return false;
      return publicClient.readContract({
        address: client.chain.appealsContract.address,
        abi: APPEALS_TRAIN_ABI,
        functionName: "canAppeal",
        args: [args.txId, context.decisionId],
        blockNumber: context.blockNumber
      });
    },
    /** Returns a developer's NFT reward record, or null when no NFT is registered. */
    getDeveloperNft: async (args) => {
      const nftMinterAddress = await _resolveNftMinterAddress({ client, publicClient });
      const nftId = await publicClient.readContract({
        address: nftMinterAddress,
        abi: NFT_MINTER_ABI,
        functionName: "developerToNFT",
        args: [args.developer]
      });
      if (nftId === 0n) {
        return null;
      }
      const [nftData, ghosts] = await Promise.all([
        publicClient.readContract({
          address: nftMinterAddress,
          abi: NFT_MINTER_ABI,
          functionName: "nfts",
          args: [nftId]
        }),
        publicClient.readContract({
          address: nftMinterAddress,
          abi: NFT_MINTER_ABI,
          functionName: "getGhostsForNFT",
          args: [nftId]
        })
      ]);
      return {
        nftId,
        developer: _nullishCoalesce(nftData.developer, () => ( nftData[0])),
        claimableRewards: _nullishCoalesce(nftData.claimableRewards, () => ( nftData[1])),
        lastClaimedEpoch: _nullishCoalesce(nftData.lastClaimedEpoch, () => ( nftData[2])),
        ghosts
      };
    },
    /** Returns claimable developer-NFT rewards accrued from transaction fees. */
    getClaimableRewardsFromFees: async (args) => {
      const nftMinterAddress = await _resolveNftMinterAddress({ client, publicClient });
      const nftId = toUInt2(args.nftId, "nftId", 0n);
      return publicClient.readContract({
        address: nftMinterAddress,
        abi: NFT_MINTER_ABI,
        functionName: "getClaimableRewardsFromFees",
        args: [nftId]
      });
    },
    /** Returns claimable developer-NFT rewards accrued from inflation. */
    getClaimableRewardsFromInflation: async (args) => {
      const nftMinterAddress = await _resolveNftMinterAddress({ client, publicClient });
      const nftId = toUInt2(args.nftId, "nftId", 0n);
      const numberOfEpochsToClaim = toUInt2(
        args.numberOfEpochsToClaim,
        "numberOfEpochsToClaim",
        0n
      );
      return publicClient.readContract({
        address: nftMinterAddress,
        abi: NFT_MINTER_ABI,
        functionName: "getClaimableRewardsFromInflation",
        args: [nftId, numberOfEpochsToClaim]
      });
    },
    /** Claims all currently available rewards for a developer NFT. Returns the EVM transaction hash. */
    claimNftRewards: async (args) => {
      const nftMinterAddress = await _resolveNftMinterAddress({ client, publicClient });
      const encodedData = _viem.encodeFunctionData.call(void 0, {
        abi: NFT_MINTER_ABI,
        functionName: "claim",
        args: [toUInt2(args.nftId, "nftId", 0n)]
      });
      return _sendEvmContractCall({
        client,
        publicClient,
        to: nftMinterAddress,
        encodedData,
        senderAccount: args.account || client.account,
        operationName: "Claim NFT rewards"
      });
    },
    /** Claims a bounded number of reward epochs for a developer NFT. Returns the EVM transaction hash. */
    claimNftEpochs: async (args) => {
      const nftMinterAddress = await _resolveNftMinterAddress({ client, publicClient });
      const encodedData = _viem.encodeFunctionData.call(void 0, {
        abi: NFT_MINTER_ABI,
        functionName: "claimEpochs",
        args: [
          toUInt2(args.nftId, "nftId", 0n),
          toUInt2(args.numberOfEpochsToClaim, "numberOfEpochsToClaim", 0n)
        ]
      });
      return _sendEvmContractCall({
        client,
        publicClient,
        to: nftMinterAddress,
        encodedData,
        senderAccount: args.account || client.account,
        operationName: "Claim NFT epochs"
      });
    },
    /**
     * Appeals a consensus transaction to trigger a new round of validation.
     * The call is bound to the active decision on both Studio and contract
     * networks. The schedule-extending entry point is safe for both pre-funded
     * and unfunded appeals, while submitAppeal rejects an unfunded next round.
     * When value is omitted, the authoritative appeal charge is used.
     */
    appealTransaction: async (args) => {
      const { account, txId } = args;
      const senderAccount = account || client.account;
      const context = await _readAppealContext({
        client,
        publicClient,
        txId,
        includeQuote: args.value === void 0
      });
      const value = _nullishCoalesce(args.value, () => ( context.requiredValue));
      const encodedData = _encodeTopUpAndSubmitAppealData({
        txId,
        expectedDecisionId: context.decisionId,
        // Consensus derives the appeal shape from live state and retains this
        // normalized zero schedule only for ABI compatibility. The same call
        // is therefore valid against both pre-funded and unfunded transactions.
        distribution: {}
      });
      await _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount,
        value,
        operationName: "Appeal"
      });
      return txId;
    },
    /**
     * Deposits additional fee budget for an existing consensus transaction.
     * Returns the signed EVM envelope hash on every backend.
     */
    topUpFees: async (args) => {
      const { account, txId, distribution, value } = args;
      const senderAccount = account || client.account;
      const encodedData = _encodeTopUpFeesData({ txId, distribution });
      return _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount,
        value,
        operationName: "Top up fees"
      });
    },
    /**
     * Deposits appeal fee budget and submits an appeal in the same consensus call.
     * Returns the existing GenLayer transaction id, matching appealTransaction.
     * The call is bound to the active decision on both Studio and contract
     * networks. When value is omitted, the authoritative appeal charge is used.
     */
    topUpAndSubmitAppeal: async (args) => {
      const { account, txId, distribution } = args;
      const senderAccount = account || client.account;
      const context = await _readAppealContext({
        client,
        publicClient,
        txId,
        includeQuote: args.value === void 0
      });
      const value = _nullishCoalesce(args.value, () => ( context.requiredValue));
      const encodedData = _encodeTopUpAndSubmitAppealData({
        txId,
        expectedDecisionId: context.decisionId,
        distribution
      });
      await _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount,
        value,
        operationName: "Top up and submit appeal"
      });
      return txId;
    },
    /** Finalizes a single GenLayer transaction that is ready to be finalized. Returns the EVM transaction hash. */
    finalizeTransaction: async (args) => {
      const { account, txId } = args;
      const senderAccount = account || client.account;
      const identity = await _readLifecycleIdentity({ client, publicClient, txId });
      if (!identity.decisionActive) {
        throw new Error(`Transaction ${txId} has no active decision to finalize`);
      }
      if (identity.resolutionAction !== 6) {
        throw new Error(
          `Transaction ${txId} is not ready to finalize (resolution action ${identity.resolutionAction})`
        );
      }
      const encodedData = _viem.encodeFunctionData.call(void 0, {
        abi: CONSENSUS_FINALIZATION_TRAIN_ABI,
        functionName: "finalizeTransaction",
        args: [txId, identity.decisionId]
      });
      return _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount,
        operationName: "Finalize"
      });
    },
    /**
     * @deprecated The train separates attempt-bound resolution from
     * decision-bound finalization. Use resolveTransactions or
     * finalizeDecisions after classifying the lifecycle action.
     */
    finalizeIdlenessTxs: async (args) => {
      throw new Error(
        `finalizeIdlenessTxs(${args.txIds.length} transaction(s)) is unavailable on the train: use resolveTransactions for attempt-bound lifecycle actions or finalizeDecisions for active decisions.`
      );
    },
    /** Resolves a batch of attempt-bound lifecycle actions. */
    resolveTransactions: async (args) => {
      if (client.chain.isStudio) {
        throw _studioTrainBatchError("resolveTransactions");
      }
      if (args.txIds.length === 0) {
        throw new Error("resolveTransactions requires at least one txId.");
      }
      const snapshot = await publicClient.getBlock();
      const identities = await Promise.all(args.txIds.map(
        (txId) => _readLifecycleIdentity({
          client,
          publicClient,
          txId,
          blockNumber: snapshot.number,
          blockTimestamp: snapshot.timestamp
        })
      ));
      const encodedData = _viem.encodeFunctionData.call(void 0, {
        abi: CONSENSUS_FINALIZATION_TRAIN_ABI,
        functionName: "resolveTransactions",
        args: [args.txIds.map((txId, index) => ({
          txId,
          expectedAttemptId: identities[index].attemptId
        }))]
      });
      return _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount: args.account || client.account,
        operationName: "Resolve transactions"
      });
    },
    /** Finalizes a batch of active, decision-bound transactions. */
    finalizeDecisions: async (args) => {
      if (client.chain.isStudio) {
        throw _studioTrainBatchError("finalizeDecisions");
      }
      if (args.txIds.length === 0) {
        throw new Error("finalizeDecisions requires at least one txId.");
      }
      const snapshot = await publicClient.getBlock();
      const identities = await Promise.all(args.txIds.map(
        (txId) => _readLifecycleIdentity({
          client,
          publicClient,
          txId,
          blockNumber: snapshot.number,
          blockTimestamp: snapshot.timestamp
        })
      ));
      identities.forEach((identity, index) => {
        if (!identity.decisionActive) {
          throw new Error(`Transaction ${args.txIds[index]} has no active decision to finalize`);
        }
        if (identity.resolutionAction !== 6) {
          throw new Error(
            `Transaction ${args.txIds[index]} is not ready to finalize (resolution action ${identity.resolutionAction})`
          );
        }
      });
      const encodedData = _viem.encodeFunctionData.call(void 0, {
        abi: CONSENSUS_FINALIZATION_TRAIN_ABI,
        functionName: "finalizeDecisions",
        args: [args.txIds.map((txId, index) => ({
          txId,
          expectedDecisionId: identities[index].decisionId
        }))]
      });
      return _sendConsensusCall({
        client,
        publicClient,
        encodedData,
        senderAccount: args.account || client.account,
        operationName: "Finalize decisions"
      });
    }
  };
};
var validateAccount = (Account5) => {
  if (!Account5) {
    throw new Error(
      "No account set. Configure the client with an account or pass an account to this function."
    );
  }
  return Account5;
};
var CREATED_TRANSACTION_EVENT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "txId", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "txSlot", type: "uint256" }
    ],
    name: "CreatedTransaction",
    type: "event"
  }
];
var FEES_DISTRIBUTION_COMPONENTS = [
  { name: "leaderTimeunitsAllocation", type: "uint256" },
  { name: "validatorTimeunitsAllocation", type: "uint256" },
  { name: "appealRounds", type: "uint256" },
  { name: "executionBudgetPerRound", type: "uint256" },
  { name: "executionConsumed", type: "uint256" },
  { name: "totalMessageFees", type: "uint256" },
  { name: "rotations", type: "uint256[]" },
  { name: "maxPriceGenPerTimeUnit", type: "uint256" },
  { name: "storageFeeMaxGasPrice", type: "uint256" },
  { name: "receiptFeeMaxGasPrice", type: "uint256" }
];
var MESSAGE_FEE_ALLOCATION_COMPONENTS = [
  { name: "messageType", type: "uint8" },
  { name: "onAcceptance", type: "bool" },
  { name: "parentIndex", type: "uint256" },
  { name: "recipient", type: "address" },
  { name: "callKey", type: "bytes32" },
  { name: "budget", type: "uint256" },
  { name: "feeParams", type: "bytes" }
];
var ADD_TRANSACTION_PARAMS_COMPONENTS = [
  { name: "sender", type: "address" },
  { name: "recipient", type: "address" },
  { name: "numOfInitialValidators", type: "uint256" },
  { name: "maxRotations", type: "uint256" },
  { name: "validUntil", type: "uint256" },
  { name: "saltNonce", type: "uint256" },
  { name: "userValue", type: "uint256" },
  { name: "feesDistribution", type: "tuple", components: FEES_DISTRIBUTION_COMPONENTS },
  { name: "txCalldata", type: "bytes" },
  { name: "messageAllocations", type: "tuple[]", components: MESSAGE_FEE_ALLOCATION_COMPONENTS }
];
var ADD_TRANSACTION_ABI_WITH_FEES = [
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "_params", type: "tuple", components: ADD_TRANSACTION_PARAMS_COMPONENTS }
    ],
    outputs: []
  }
];
var CONSENSUS_FEE_MANAGEMENT_ABI = [
  {
    type: "function",
    name: "topUpFees",
    stateMutability: "payable",
    inputs: [
      { name: "_txId", type: "bytes32" },
      { name: "_feesDistribution", type: "tuple", components: FEES_DISTRIBUTION_COMPONENTS }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "topUpAndSubmitAppeal",
    stateMutability: "payable",
    inputs: [
      { name: "_txId", type: "bytes32" },
      { name: "_expectedDecisionId", type: "uint256" },
      { name: "_feesDistribution", type: "tuple", components: FEES_DISTRIBUTION_COMPONENTS }
    ],
    outputs: []
  }
];
var CONSENSUS_FINALIZATION_TRAIN_ABI = [
  {
    type: "function",
    name: "finalizeTransaction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_txId", type: "bytes32" },
      { name: "_expectedDecisionId", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "resolveTransactions",
    stateMutability: "nonpayable",
    inputs: [{
      name: "_commands",
      type: "tuple[]",
      components: [
        { name: "txId", type: "bytes32" },
        { name: "expectedAttemptId", type: "bytes32" }
      ]
    }],
    outputs: []
  },
  {
    type: "function",
    name: "finalizeDecisions",
    stateMutability: "nonpayable",
    inputs: [{
      name: "_commands",
      type: "tuple[]",
      components: [
        { name: "txId", type: "bytes32" },
        { name: "expectedDecisionId", type: "uint256" }
      ]
    }],
    outputs: []
  }
];
var APPEALS_TRAIN_ABI = [
  {
    type: "function",
    name: "canAppeal",
    stateMutability: "view",
    inputs: [
      { name: "_txId", type: "bytes32" },
      { name: "_expectedDecisionId", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];
var FEE_MANAGER_CALCULATE_ROUND_FEES_ABI = [
  {
    type: "function",
    name: "GENPerTimeUnit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "storageUnitPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "quoteGasPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "messageFeeParamsBudgetFloor",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "calculateRoundFees",
    stateMutability: "view",
    inputs: [
      { name: "_feesDistribution", type: "tuple", components: FEES_DISTRIBUTION_COMPONENTS },
      { name: "_numOfValidators", type: "uint256" },
      { name: "round", type: "uint256" }
    ],
    outputs: [{ name: "totalFeesToPay", type: "uint256" }]
  }
];
var toUInt2 = (value, fieldName, fallback) => {
  if (value === void 0) {
    return fallback;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be a safe integer when provided as a number.`);
  }
  const normalized = BigInt(value);
  if (normalized < 0n) {
    throw new Error(`${fieldName} must be greater than or equal to zero.`);
  }
  return normalized;
};
var hasAbiFunction = (abi, functionName) => {
  if (!Array.isArray(abi)) {
    return false;
  }
  return abi.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item;
    return candidate.type === "function" && candidate.name === functionName;
  });
};
var _resolveAddressManagerAddress = async ({
  client,
  publicClient
}) => {
  const consensusMainContract = client.chain.consensusMainContract;
  if (!_optionalChain([consensusMainContract, 'optionalAccess', _34 => _34.address])) {
    throw new Error("NFTMinter address resolution not supported on this chain (missing consensusMainContract).");
  }
  const functionName = hasAbiFunction(consensusMainContract.abi, "getAddressManager") ? "getAddressManager" : hasAbiFunction(consensusMainContract.abi, "addressManager") ? "addressManager" : void 0;
  if (!functionName) {
    throw new Error("NFTMinter address resolution not supported on this chain (missing AddressManager getter).");
  }
  const addressManagerAddress = await publicClient.readContract({
    address: consensusMainContract.address,
    abi: consensusMainContract.abi,
    functionName,
    args: []
  });
  if (addressManagerAddress.toLowerCase() === _viem.zeroAddress) {
    throw new Error("NFTMinter address resolution failed: AddressManager is zero.");
  }
  return addressManagerAddress;
};
var _resolveNftMinterAddress = async ({
  client,
  publicClient
}) => {
  const addressManagerAddress = await _resolveAddressManagerAddress({ client, publicClient });
  const nftMinterAddress = await publicClient.readContract({
    address: addressManagerAddress,
    abi: ADDRESS_MANAGER_ABI,
    functionName: "getAddressNonZero",
    args: ["NFTMinter"]
  });
  if (nftMinterAddress.toLowerCase() === _viem.zeroAddress) {
    throw new Error("NFTMinter address resolution failed: AddressManager returned zero.");
  }
  return nftMinterAddress;
};
var getDefaultValidUntil = () => BigInt(Math.floor(Date.now() / 1e3) + 3600);
var requiresFeeDepositCalculation = (distribution) => distribution.leaderTimeunitsAllocation !== 0n || distribution.validatorTimeunitsAllocation !== 0n || distribution.executionBudgetPerRound !== 0n || distribution.totalMessageFees !== 0n;
var DEFAULT_PRICE_CAP_HEADROOM_BPS = 12000n;
var DEFAULT_LEADER_TIMEUNITS_ALLOCATION = 100n;
var DEFAULT_VALIDATOR_TIMEUNITS_ALLOCATION = 200n;
var DEFAULT_TRANSACTION_EXECUTION_BUDGET_PER_ROUND = 500000n;
var DEFAULT_TRANSACTION_EXECUTION_GAS = 100000000n;
var DEFAULT_RECEIPT_SLOTS_CHANGED = 7n;
var DEFAULT_INTRINSIC_GAS = 21000n;
var DEFAULT_BOOTLOADER_OVERHEAD = 60000n;
var DEFAULT_GAS_PER_CHANGED_SLOT = 1000n;
var DEFAULT_CALLDATA_GAS_PER_BYTE = 16n;
var DEFAULT_FIXED_PROPOSE_RECEIPT_GAS = 210000n;
var DEFAULT_FIXED_MESSAGE_REVEAL_GAS = 100000n;
var DEFAULT_MIN_RECEIPT_BYTES = 512n;
var DEFAULT_MESSAGE_REVEAL_LENGTH_SLOTS = 32n;
var DEFAULT_NONDET_OUTPUT_LENGTH_BYTES = 32n;
var TRANSACTION_GAS_HEADROOM_BPS = 20000n;
var DEFAULT_PARENT_MESSAGE_RECEIPT_HEADROOM = 10000n;
var VALIDATORS_PER_ROUND = [
  5n,
  7n,
  11n,
  13n,
  23n,
  25n,
  47n,
  49n,
  95n,
  97n,
  191n,
  193n,
  383n,
  385n,
  767n,
  769n,
  1535n,
  1537n
];
var withCapHeadroom = (value, headroomBps) => {
  if (value === 0n) return 0n;
  return (value * headroomBps + 9999n) / 10000n;
};
var withTransactionGasHeadroom = (value) => {
  if (value === 0n) return 0n;
  return (value * TRANSACTION_GAS_HEADROOM_BPS + 9999n) / 10000n;
};
var bigintFromUnknown = (value, fieldName, fallback = 0n) => {
  if (value == null) return fallback;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && value.trim() !== "") return BigInt(value);
  throw new Error(`${fieldName} is not an integer value.`);
};
var extractStudioFeePolicy = (config) => {
  const configRecord = config && typeof config === "object" && !Array.isArray(config) ? config : void 0;
  const policy = _optionalChain([configRecord, 'optionalAccess', _35 => _35.policy]);
  const enabled = _optionalChain([configRecord, 'optionalAccess', _36 => _36.enabled]);
  if (enabled !== void 0 && typeof enabled !== "boolean") {
    throw new Error(`sim_getFeeConfig enabled flag is not a boolean.`);
  }
  const policyRecord = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : void 0;
  if (!policyRecord) {
    throw new Error(`sim_getFeeConfig did not expose a policy object.`);
  }
  const genPerTimeUnit = bigintFromUnknown(policyRecord.genPerTimeUnit, "policy.genPerTimeUnit");
  const storageUnitPrice = bigintFromUnknown(policyRecord.storageUnitPrice, "policy.storageUnitPrice");
  const receiptGasPrice = bigintFromUnknown(policyRecord.receiptGasPrice, "policy.receiptGasPrice");
  const timeUnitOverlayBps = bigintFromUnknown(
    policyRecord.timeUnitOverlayBps,
    "policy.timeUnitOverlayBps"
  );
  const intrinsicGas = bigintFromUnknown(policyRecord.intrinsicGas, "policy.intrinsicGas", DEFAULT_INTRINSIC_GAS);
  const bootloaderOverhead = bigintFromUnknown(
    policyRecord.bootloaderOverhead,
    "policy.bootloaderOverhead",
    DEFAULT_BOOTLOADER_OVERHEAD
  );
  const gasPerChangedSlot = bigintFromUnknown(
    policyRecord.gasPerChangedSlot,
    "policy.gasPerChangedSlot",
    DEFAULT_GAS_PER_CHANGED_SLOT
  );
  const calldataGasPerByte = bigintFromUnknown(
    policyRecord.calldataGasPerByte,
    "policy.calldataGasPerByte",
    DEFAULT_CALLDATA_GAS_PER_BYTE
  );
  const fixedProposeReceiptGas = bigintFromUnknown(
    policyRecord.fixedProposeReceiptGas,
    "policy.fixedProposeReceiptGas",
    DEFAULT_FIXED_PROPOSE_RECEIPT_GAS
  );
  const fixedMessageRevealGas = bigintFromUnknown(
    policyRecord.fixedMessageRevealGas,
    "policy.fixedMessageRevealGas",
    DEFAULT_FIXED_MESSAGE_REVEAL_GAS
  );
  const executionBudgetFloor = policyRecord.messageFeeParamsBudgetFloor == null ? receiptGasPrice * (fixedProposeReceiptGas + intrinsicGas + bootloaderOverhead + DEFAULT_RECEIPT_SLOTS_CHANGED * gasPerChangedSlot + fixedMessageRevealGas + intrinsicGas + bootloaderOverhead + DEFAULT_MESSAGE_REVEAL_LENGTH_SLOTS * gasPerChangedSlot + DEFAULT_NONDET_OUTPUT_LENGTH_BYTES * calldataGasPerByte) : bigintFromUnknown(
    policyRecord.messageFeeParamsBudgetFloor,
    "policy.messageFeeParamsBudgetFloor"
  );
  return {
    enabled: _nullishCoalesce(enabled, () => ( (genPerTimeUnit > 0n || storageUnitPrice > 0n || receiptGasPrice > 0n))),
    genPerTimeUnit,
    storageUnitPrice,
    receiptGasPrice,
    executionBudgetFloor,
    timeUnitOverlayBps
  };
};
var readCurrentFeePolicy = async (client, publicClient) => {
  if (client.chain.isStudio) {
    const config = await client.request({ method: "sim_getFeeConfig", params: [] });
    return extractStudioFeePolicy(config);
  }
  if (!_optionalChain([client, 'access', _37 => _37.chain, 'access', _38 => _38.feeManagerContract, 'optionalAccess', _39 => _39.address])) {
    throw new Error("Fee policy estimation is not supported on this chain (missing feeManagerContract).");
  }
  const address = client.chain.feeManagerContract.address;
  const abi = FEE_MANAGER_CALCULATE_ROUND_FEES_ABI;
  const [genPerTimeUnit, storageUnitPrice, quotedReceiptGasPrice, executionBudgetFloor] = await Promise.all([
    publicClient.readContract({ address, abi, functionName: "GENPerTimeUnit", args: [] }),
    publicClient.readContract({ address, abi, functionName: "storageUnitPrice", args: [] }),
    publicClient.readContract({ address, abi, functionName: "quoteGasPrice", args: [] }),
    publicClient.readContract({ address, abi, functionName: "messageFeeParamsBudgetFloor", args: [] })
  ]);
  const enabled = genPerTimeUnit > 0n || storageUnitPrice > 0n || quotedReceiptGasPrice > 0n;
  const networkReceiptGasPrice = enabled ? await publicClient.getGasPrice() : 0n;
  const receiptGasPrice = maxBigint(quotedReceiptGasPrice, networkReceiptGasPrice);
  if (enabled && receiptGasPrice === 0n) {
    throw new Error("receipt gas price quoted as zero; refusing to build a zero price cap");
  }
  const localExecutionBudgetFloor = receiptGasPrice * (DEFAULT_FIXED_PROPOSE_RECEIPT_GAS + DEFAULT_INTRINSIC_GAS + DEFAULT_BOOTLOADER_OVERHEAD + DEFAULT_MIN_RECEIPT_BYTES * DEFAULT_CALLDATA_GAS_PER_BYTE + DEFAULT_RECEIPT_SLOTS_CHANGED * DEFAULT_GAS_PER_CHANGED_SLOT);
  return {
    enabled,
    genPerTimeUnit,
    storageUnitPrice,
    receiptGasPrice,
    executionBudgetFloor: maxBigint(executionBudgetFloor, localExecutionBudgetFloor),
    // Live networks quote through FeeManager.calculateRoundFees; this field is
    // only consumed by Studio's local mirror.
    timeUnitOverlayBps: 0n
  };
};
var maxBigint = (...values) => values.reduce(
  (max, value) => value > max ? value : max,
  0n
);
var defaultExecutionBudgetPerRound = (policy) => {
  if (!policy.enabled || policy.storageUnitPrice === 0n && policy.receiptGasPrice === 0n) {
    return 0n;
  }
  return maxBigint(
    DEFAULT_TRANSACTION_EXECUTION_BUDGET_PER_ROUND,
    policy.executionBudgetFloor,
    policy.receiptGasPrice * DEFAULT_TRANSACTION_EXECUTION_GAS
  );
};
var buildEstimatedFeesDistribution = (options, policy, defaultConsensusMaxRotations) => {
  const headroomBps = toUInt2(
    _optionalChain([options, 'optionalAccess', _40 => _40.priceCapHeadroomBps]),
    "priceCapHeadroomBps",
    DEFAULT_PRICE_CAP_HEADROOM_BPS
  );
  const baseExecutionBudgetDefault = defaultExecutionBudgetPerRound(policy);
  const messageAllocations = _optionalChain([options, 'optionalAccess', _41 => _41.messageAllocations]) ? normalizeMessageFeeAllocations(options.messageAllocations) : void 0;
  const totalMessageFees = _nullishCoalesce(_optionalChain([options, 'optionalAccess', _42 => _42.totalMessageFees]), () => ( (messageAllocations ? messageAllocations.reduce(
    (sum, allocation) => {
      if (allocation.messageType === 0 /* External */ || allocation.parentIndex === MESSAGE_ALLOCATION_ROOT_PARENT_INDEX) {
        return sum + allocation.budget;
      }
      return sum;
    },
    0n
  ) : void 0)));
  const emitsMessages = (_nullishCoalesce(_optionalChain([messageAllocations, 'optionalAccess', _43 => _43.length]), () => ( 0))) > 0 || totalMessageFees !== void 0 && toUInt2(totalMessageFees, "totalMessageFees", 0n) > 0n;
  const executionBudgetDefault = emitsMessages ? baseExecutionBudgetDefault + policy.receiptGasPrice * DEFAULT_PARENT_MESSAGE_RECEIPT_HEADROOM : baseExecutionBudgetDefault;
  const appealRounds = toUInt2(_optionalChain([options, 'optionalAccess', _44 => _44.appealRounds]), "appealRounds", 0n);
  const rotationsCount = Number(appealRounds + 1n);
  if (!Number.isSafeInteger(rotationsCount)) {
    throw new Error("rotations appealRounds is too large.");
  }
  let rotations = _optionalChain([options, 'optionalAccess', _45 => _45.rotations]);
  if (rotations === void 0) {
    const defaultRotationBudget = toUInt2(
      defaultConsensusMaxRotations,
      "defaultConsensusMaxRotations",
      0n
    );
    rotations = Array.from({ length: rotationsCount }, () => defaultRotationBudget);
  }
  return createFeesDistribution({
    leaderTimeunitsAllocation: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _46 => _46.leaderTimeunitsAllocation]), () => ( (policy.enabled ? DEFAULT_LEADER_TIMEUNITS_ALLOCATION : 0n))),
    validatorTimeunitsAllocation: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _47 => _47.validatorTimeunitsAllocation]), () => ( (policy.enabled ? DEFAULT_VALIDATOR_TIMEUNITS_ALLOCATION : 0n))),
    appealRounds,
    executionBudgetPerRound: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _48 => _48.executionBudgetPerRound]), () => ( executionBudgetDefault)),
    executionConsumed: _optionalChain([options, 'optionalAccess', _49 => _49.executionConsumed]),
    totalMessageFees,
    rotations,
    maxPriceGenPerTimeUnit: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _50 => _50.maxPriceGenPerTimeUnit]), () => ( withCapHeadroom(policy.genPerTimeUnit, headroomBps))),
    storageFeeMaxGasPrice: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _51 => _51.storageFeeMaxGasPrice]), () => ( withCapHeadroom(policy.storageUnitPrice, headroomBps))),
    receiptFeeMaxGasPrice: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _52 => _52.receiptFeeMaxGasPrice]), () => ( withCapHeadroom(policy.receiptGasPrice, headroomBps)))
  });
};
var asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
var feeAccountingFromSimulation = (simulation) => {
  const direct = simulation.feeAccounting;
  if (direct) return direct;
  const receipt = asRecord(simulation.receipt);
  const genvmResult = asRecord(_optionalChain([receipt, 'optionalAccess', _53 => _53.genvm_result]));
  const feeAccounting = asRecord(_optionalChain([genvmResult, 'optionalAccess', _54 => _54.fee_accounting]));
  return feeAccounting;
};
var messageAllocationsFromAccounting = (accounting) => {
  if (!Array.isArray(_optionalChain([accounting, 'optionalAccess', _55 => _55.message_allocations])) || accounting.message_allocations.length === 0) {
    return void 0;
  }
  return accounting.message_allocations.map((raw, index) => {
    const allocation = asRecord(raw);
    if (!allocation) {
      throw new Error(`simulation.feeAccounting.message_allocations[${index}] must be an object.`);
    }
    return {
      messageType: Number(toUInt2(
        allocation.messageType,
        `simulation.feeAccounting.message_allocations[${index}].messageType`,
        0n
      )),
      onAcceptance: Boolean(allocation.onAcceptance),
      parentIndex: toUInt2(
        allocation.parentIndex,
        `simulation.feeAccounting.message_allocations[${index}].parentIndex`,
        MESSAGE_ALLOCATION_ROOT_PARENT_INDEX
      ),
      recipient: String(_nullishCoalesce(allocation.recipient, () => ( _viem.zeroAddress))),
      callKey: prefixHex(String(_nullishCoalesce(allocation.callKey, () => ( CALL_KEY_WILDCARD)))),
      budget: toUInt2(
        allocation.budget,
        `simulation.feeAccounting.message_allocations[${index}].budget`,
        0n
      ),
      feeParams: prefixHex(String(_nullishCoalesce(allocation.feeParams, () => ( "0x"))))
    };
  });
};
var observedSimulationFeeUsage = (args, policy) => {
  const accounting = feeAccountingFromSimulation(args.simulation);
  const report = _nullishCoalesce(args.simulation.feeReport, () => ( _optionalChain([accounting, 'optionalAccess', _56 => _56.execution_fee_report])));
  const executionHeadroomBps = toUInt2(
    args.executionHeadroomBps,
    "executionHeadroomBps",
    DEFAULT_PRICE_CAP_HEADROOM_BPS
  );
  const messageHeadroomBps = toUInt2(
    args.messageHeadroomBps,
    "messageHeadroomBps",
    DEFAULT_PRICE_CAP_HEADROOM_BPS
  );
  const executionFeeConsumed = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _57 => _57.execution_fee_consumed]),
    "simulation.feeAccounting.execution_fee_consumed"
  );
  const executionFeeReportTotal = bigintFromUnknown(
    _optionalChain([report, 'optionalAccess', _58 => _58.totalEstimatedFee]),
    "simulation.feeReport.totalEstimatedFee"
  );
  const observedExecutionBudget = executionFeeConsumed + executionFeeReportTotal;
  const recommendedExecutionBudgetPerRound = observedExecutionBudget > 0n ? maxBigint(
    policy.executionBudgetFloor,
    withCapHeadroom(observedExecutionBudget, executionHeadroomBps)
  ) : 0n;
  const messageFeeConsumed = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _59 => _59.message_fee_consumed]),
    "simulation.feeAccounting.message_fee_consumed"
  );
  const genvmMessageFeeConsumed = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _60 => _60.genvm_message_fee_consumed]),
    "simulation.feeAccounting.genvm_message_fee_consumed"
  );
  const messageFeeBudget = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _61 => _61.message_fee_budget]),
    "simulation.feeAccounting.message_fee_budget"
  );
  const externalMessageReimbursed = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _62 => _62.external_message_fee_reimbursed]),
    "simulation.feeAccounting.external_message_fee_reimbursed"
  );
  const messageFeeRefunded = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _63 => _63.message_fee_refunded]),
    "simulation.feeAccounting.message_fee_refunded"
  );
  const externalMessageReserved = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _64 => _64.external_message_fee_reserved]),
    "simulation.feeAccounting.external_message_fee_reserved"
  );
  const externalMessageRemainder = bigintFromUnknown(
    _optionalChain([accounting, 'optionalAccess', _65 => _65.external_message_fee_remainder]),
    "simulation.feeAccounting.external_message_fee_remainder"
  );
  const internalDeclaredBudget = (_nullishCoalesce(_optionalChain([report, 'optionalAccess', _66 => _66.messageReveal, 'optionalAccess', _67 => _67.messages]), () => ( []))).reduce(
    (sum, message, index) => message.messageType === "Internal" ? sum + bigintFromUnknown(
      message.declaredBudget,
      `simulation.feeReport.messageReveal.messages[${index}].declaredBudget`
    ) : sum,
    0n
  );
  const observedMessageBudget = maxBigint(
    messageFeeConsumed,
    internalDeclaredBudget + externalMessageReimbursed
  );
  return {
    executionFeeConsumed,
    executionFeeReportTotal,
    recommendedExecutionBudgetPerRound,
    genvmMessageFeeConsumed,
    messageFeeBudget,
    messageFeeConsumed,
    messageFeeRefunded,
    internalDeclaredBudget,
    externalMessageReserved,
    externalMessageReimbursed,
    externalMessageRemainder,
    recommendedTotalMessageFees: observedMessageBudget > 0n ? withCapHeadroom(observedMessageBudget, messageHeadroomBps) : 0n
  };
};
var transactionFeeEstimateFromStudioEstimate = (result, policy) => {
  const estimate = asRecord(result);
  const preset = asRecord(_optionalChain([estimate, 'optionalAccess', _68 => _68.recommendedPreset]));
  const distributionInput = asRecord(_optionalChain([preset, 'optionalAccess', _69 => _69.distribution]));
  if (!preset || !distributionInput || preset.feeValue === void 0) {
    return void 0;
  }
  const rawAllocations = Array.isArray(preset.messageAllocations) ? preset.messageAllocations : void 0;
  const feeAccounting = asRecord(_optionalChain([estimate, 'optionalAccess', _70 => _70.feeAccounting]));
  const feeReport = _nullishCoalesce(asRecord(_optionalChain([estimate, 'optionalAccess', _71 => _71.feeReport])), () => ( asRecord(_optionalChain([feeAccounting, 'optionalAccess', _72 => _72.execution_fee_report]))));
  return {
    distribution: createFeesDistribution(distributionInput),
    messageAllocations: rawAllocations && rawAllocations.length > 0 ? normalizeMessageFeeAllocations(rawAllocations) : void 0,
    feeValue: bigintFromUnknown(preset.feeValue, "recommendedPreset.feeValue"),
    policy,
    observed: observedSimulationFeeUsage(
      {
        simulation: {
          feeAccounting,
          feeReport
        }
      },
      policy
    )
  };
};
var buildEstimatedFeesOptionsFromSimulation = (args, policy) => {
  const {
    simulation,
    executionHeadroomBps,
    messageHeadroomBps,
    ...feeOptions
  } = args;
  const accounting = feeAccountingFromSimulation(args.simulation);
  const observed = observedSimulationFeeUsage(args, policy);
  const messageAllocations = _nullishCoalesce(feeOptions.messageAllocations, () => ( messageAllocationsFromAccounting(accounting)));
  return {
    estimateOptions: {
      ...feeOptions,
      messageAllocations,
      executionBudgetPerRound: _nullishCoalesce(feeOptions.executionBudgetPerRound, () => ( (observed.recommendedExecutionBudgetPerRound > 0n ? observed.recommendedExecutionBudgetPerRound : void 0))),
      totalMessageFees: _nullishCoalesce(feeOptions.totalMessageFees, () => ( (messageAllocations ? void 0 : observed.recommendedTotalMessageFees > 0n ? observed.recommendedTotalMessageFees : void 0)))
    },
    observed,
    messageAllocations
  };
};
var validatorIndex = (numOfValidators) => {
  const needle = BigInt(numOfValidators);
  const index = VALIDATORS_PER_ROUND.findIndex((validators) => validators === needle);
  if (index < 0) {
    throw new Error(`InvalidNumOfValidators: ${numOfValidators}`);
  }
  return index;
};
var calculateFeeForRound = (numOfValidators, rotations, leaderTimeunitsAllocation, validatorTimeunitsAllocation) => rotations * (leaderTimeunitsAllocation + numOfValidators * validatorTimeunitsAllocation);
var validatorsPerRoundSafe = (round) => VALIDATORS_PER_ROUND[Math.min(Math.max(round, 0), VALIDATORS_PER_ROUND.length - 1)];
var successfulAppealProfit = (appealBond) => appealBond + appealBond / 2n;
var calculateLocalRoundFees = (distribution, numOfInitialValidators, policy) => {
  if (distribution.appealRounds !== BigInt(distribution.rotations.length - 1)) {
    throw new Error("InvalidAppealRounds");
  }
  if (distribution.maxPriceGenPerTimeUnit > 0n && policy.genPerTimeUnit > distribution.maxPriceGenPerTimeUnit) {
    throw new Error("MaxPriceExceeded");
  }
  if (distribution.storageFeeMaxGasPrice > 0n && policy.storageUnitPrice > distribution.storageFeeMaxGasPrice) {
    throw new Error("MaxPriceExceeded");
  }
  if (distribution.receiptFeeMaxGasPrice > 0n && policy.receiptGasPrice > distribution.receiptFeeMaxGasPrice) {
    throw new Error("MaxPriceExceeded");
  }
  const startIndex = validatorIndex(numOfInitialValidators);
  let taxableWork = calculateFeeForRound(
    VALIDATORS_PER_ROUND[startIndex],
    distribution.rotations[0] + 1n,
    distribution.leaderTimeunitsAllocation,
    distribution.validatorTimeunitsAllocation
  );
  let rotationsIndex = 1;
  let rotationsThisRound = 1n;
  for (let offset = 1; offset <= Number(distribution.appealRounds * 2n); offset++) {
    if (offset % 2 === 0 && rotationsIndex < distribution.rotations.length) {
      rotationsThisRound = distribution.rotations[rotationsIndex] + 1n;
      rotationsIndex += 1;
    } else if (offset % 2 === 1) {
      rotationsThisRound = 1n;
    }
    taxableWork += calculateFeeForRound(
      validatorsPerRoundSafe(offset),
      rotationsThisRound,
      distribution.leaderTimeunitsAllocation,
      distribution.validatorTimeunitsAllocation
    );
  }
  const priceCap = distribution.maxPriceGenPerTimeUnit;
  if (priceCap > 0n) {
    taxableWork *= priceCap;
  }
  let appealProfitReserve = 0n;
  for (let appealOrdinal = 0; appealOrdinal < Number(distribution.appealRounds); appealOrdinal++) {
    const nextNormalBond = calculateFeeForRound(
      validatorsPerRoundSafe((appealOrdinal + 1) * 2),
      distribution.rotations[appealOrdinal + 1] + 1n,
      distribution.leaderTimeunitsAllocation,
      distribution.validatorTimeunitsAllocation
    ) * (priceCap > 0n ? priceCap : 1n);
    appealProfitReserve += successfulAppealProfit(nextNormalBond);
  }
  const overlayBps = _nullishCoalesce(policy.timeUnitOverlayBps, () => ( 0n));
  if (overlayBps < 0n || overlayBps >= 10000n) {
    throw new Error("InvalidTimeUnitOverlayBps");
  }
  const overlay = overlayBps === 0n ? 0n : taxableWork * overlayBps / (10000n - overlayBps);
  const leaderRounds = distribution.rotations.reduce(
    (sum, rotations) => sum + rotations + 1n,
    distribution.appealRounds
  );
  return taxableWork + appealProfitReserve + overlay + distribution.executionBudgetPerRound * leaderRounds;
};
var _resolveTransactionFees = async ({
  client,
  publicClient,
  fees,
  numOfInitialValidators
}) => {
  const transactionFees = normalizeTransactionFees(fees);
  if (transactionFees.feeValue !== void 0 || !requiresFeeDepositCalculation(transactionFees.distribution)) {
    return {
      ...transactionFees,
      feeValue: _nullishCoalesce(transactionFees.feeValue, () => ( 0n))
    };
  }
  if (!_optionalChain([client, 'access', _73 => _73.chain, 'access', _74 => _74.feeManagerContract, 'optionalAccess', _75 => _75.address])) {
    if (client.chain.isStudio) {
      const policy = await readCurrentFeePolicy(client, publicClient);
      return {
        ...transactionFees,
        feeValue: policy.enabled ? calculateLocalRoundFees(
          transactionFees.distribution,
          numOfInitialValidators,
          policy
        ) + transactionFees.distribution.totalMessageFees : 0n
      };
    }
    throw new Error("fees.feeValue is required when the chain does not expose a feeManagerContract.");
  }
  const roundFees = await publicClient.readContract({
    address: client.chain.feeManagerContract.address,
    abi: FEE_MANAGER_CALCULATE_ROUND_FEES_ABI,
    functionName: "calculateRoundFees",
    args: [
      transactionFees.distribution,
      BigInt(numOfInitialValidators),
      0n
    ]
  });
  return {
    ...transactionFees,
    feeValue: roundFees + transactionFees.distribution.totalMessageFees
  };
};
var _encodeAddTransactionData = ({
  client,
  senderAccount,
  recipient,
  data,
  consensusMaxRotations = client.chain.defaultConsensusMaxRotations,
  validUntil,
  userValue = 0n,
  transactionFees
}) => {
  const validatedSenderAccount = validateAccount(senderAccount);
  const txCalldata = _nullishCoalesce(data, () => ( "0x"));
  const txRecipient = _nullishCoalesce(recipient, () => ( _viem.zeroAddress));
  const txValidUntil = toUInt2(validUntil, "validUntil", getDefaultValidUntil());
  const feeValue = _nullishCoalesce(transactionFees.feeValue, () => ( 0n));
  const params = {
    sender: validatedSenderAccount.address,
    recipient: txRecipient,
    numOfInitialValidators: BigInt(client.chain.defaultNumberOfInitialValidators),
    maxRotations: BigInt(consensusMaxRotations),
    validUntil: txValidUntil,
    saltNonce: 0n,
    userValue,
    feesDistribution: transactionFees.distribution,
    txCalldata,
    messageAllocations: transactionFees.messageAllocations
  };
  return [{
    encodedData: _viem.encodeFunctionData.call(void 0, {
      abi: ADD_TRANSACTION_ABI_WITH_FEES,
      functionName: "addTransaction",
      args: [params]
    }),
    value: userValue + feeValue
  }];
};
var _studioTrainBatchError = (action) => new Error(
  `${action} is not exposed by Studio's embedded consensus: use finalizeTransaction for an individual Studio transaction.`
);
var ROUND_PAGE_SIZE = 64n;
var _unpackRoundValidatorPage = (value) => ({
  validators: _nullishCoalesce(value.validators, () => ( value[0])),
  total: BigInt(_nullishCoalesce(value.total, () => ( value[1])))
});
var _readRoundDataSnapshot = async ({
  publicClient,
  address,
  txId,
  round,
  blockNumber
}) => {
  const read = (functionName, args) => publicClient.readContract({
    address,
    abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
    functionName,
    args,
    blockNumber
  });
  const [
    leaderIndex,
    votesCommitted,
    votesRevealed,
    appealBond,
    rotationsLeft,
    result,
    validatorVotes,
    validatorVotesHash,
    validatorResultHash,
    firstPageRaw
  ] = await Promise.all([
    read("getLeaderIndex", [txId, round]),
    read("getVotesCommitted", [txId, round]),
    read("getVotesRevealed", [txId, round]),
    read("getAppealBond", [txId, round]),
    read("getRotationsLeft", [txId, round]),
    read("getResult", [txId, round]),
    read("getValidatorVotes", [txId, round]),
    read("getValidatorVotesHash", [txId, round]),
    read("getValidatorResultHash", [txId, round]),
    read("getRoundValidatorsPage", [txId, round, 0n, ROUND_PAGE_SIZE])
  ]);
  const firstPage = _unpackRoundValidatorPage(firstPageRaw);
  const offsets = [];
  for (let offset = ROUND_PAGE_SIZE; offset < firstPage.total; offset += ROUND_PAGE_SIZE) {
    offsets.push(offset);
  }
  const remainingPages = await Promise.all(
    offsets.map((offset) => read("getRoundValidatorsPage", [txId, round, offset, ROUND_PAGE_SIZE]))
  );
  const pages = [firstPage, ...remainingPages.map(_unpackRoundValidatorPage)];
  if (pages.some((page) => page.total !== firstPage.total)) {
    throw new Error("Round validator page total changed within a fixed block snapshot");
  }
  const roundValidators = pages.flatMap((page) => [...page.validators]);
  const expected = Number(firstPage.total);
  if (roundValidators.length !== expected) {
    throw new Error(`Incomplete round validator pages: expected ${expected}, received ${roundValidators.length}`);
  }
  for (const [name, values] of [
    ["validator votes", validatorVotes],
    ["validator vote hashes", validatorVotesHash],
    ["validator result hashes", validatorResultHash]
  ]) {
    if (values.length !== expected) {
      throw new Error(`Incomplete ${name}: expected ${expected}, received ${values.length}`);
    }
  }
  return {
    round,
    leaderIndex,
    votesCommitted,
    votesRevealed,
    appealBond,
    rotationsLeft,
    result: Number(result),
    roundValidators,
    validatorVotes: [...validatorVotes].map(Number),
    validatorVotesHash: [...validatorVotesHash],
    validatorResultHash: [...validatorResultHash]
  };
};
var _readLifecycleIdentity = async ({
  client,
  publicClient,
  txId,
  blockNumber,
  blockTimestamp
}) => {
  if (client.chain.isStudio) {
    const lifecycle2 = await client.request({
      method: "gen_getTransactionLifecycle",
      params: [{ txId }]
    });
    if (typeof lifecycle2.decisionActive !== "boolean") {
      throw new Error(
        `Studio returned an invalid decisionActive for ${txId}: ${String(lifecycle2.decisionActive)}`
      );
    }
    const decisionId = lifecycle2.decisionActive ? BigInt(String(lifecycle2.decisionId)) : 0n;
    const evaluatedAt = BigInt(String(_nullishCoalesce(lifecycle2.evaluatedAt, () => ( 0))));
    return {
      blockNumber: 0n,
      blockTimestamp: evaluatedAt,
      resolutionAction: Number(lifecycle2.resolutionActionCode),
      attemptId: `0x${"00".repeat(32)}`,
      decisionActive: lifecycle2.decisionActive,
      decisionId
    };
  }
  const consensusDataAddress = _optionalChain([client, 'access', _76 => _76.chain, 'access', _77 => _77.consensusDataContract, 'optionalAccess', _78 => _78.address]);
  if (!consensusDataAddress || consensusDataAddress === _viem.zeroAddress) {
    throw new Error("ConsensusData contract is not configured for this chain");
  }
  let snapshotNumber = blockNumber;
  let snapshotTimestamp = blockTimestamp;
  if (snapshotNumber === void 0 || snapshotTimestamp === void 0) {
    const snapshot = await publicClient.getBlock();
    snapshotNumber = snapshot.number;
    snapshotTimestamp = snapshot.timestamp;
  }
  const lifecycle = await publicClient.readContract({
    address: consensusDataAddress,
    abi: CONSENSUS_DATA_TRAIN_ABI,
    functionName: "getTransactionLifecycle",
    args: [txId, snapshotTimestamp],
    blockNumber: snapshotNumber
  });
  const resolution = _nullishCoalesce(lifecycle.resolution, () => ( lifecycle[1]));
  const latestDecision = _nullishCoalesce(lifecycle.latestDecision, () => ( lifecycle[2]));
  const decisionActive = Boolean(_nullishCoalesce(lifecycle.decisionActive, () => ( lifecycle[3])));
  return {
    blockNumber: snapshotNumber,
    blockTimestamp: snapshotTimestamp,
    resolutionAction: Number(_nullishCoalesce(resolution.action, () => ( resolution[3]))),
    attemptId: _nullishCoalesce(resolution.attemptId, () => ( resolution[15])),
    decisionActive,
    decisionId: decisionActive ? BigInt(_nullishCoalesce(latestDecision.decisionId, () => ( latestDecision[1]))) : 0n
  };
};
var _readAppealContext = async ({
  client,
  publicClient,
  txId,
  includeQuote = true
}) => {
  const identity = await _readLifecycleIdentity({ client, publicClient, txId });
  if (!identity.decisionActive) {
    throw new Error(`Transaction ${txId} has no active decision to appeal`);
  }
  if (!includeQuote) {
    return { ...identity, requiredValue: 0n };
  }
  if (client.chain.isStudio) {
    const quote2 = await client.request({
      method: "gen_estimateLatestAppealCharge",
      params: [{ txId }]
    });
    const quoteDecisionId2 = BigInt(String(quote2.decisionId));
    if (quoteDecisionId2 !== identity.decisionId) {
      throw new Error(
        `Appeal decision changed while reading ${txId}: expected ${identity.decisionId}, received ${quoteDecisionId2}`
      );
    }
    return {
      ...identity,
      requiredValue: BigInt(String(quote2.bond)) + BigInt(String(quote2.funding))
    };
  }
  const consensusDataAddress = client.chain.consensusDataContract.address;
  const quote = await publicClient.readContract({
    address: consensusDataAddress,
    abi: CONSENSUS_DATA_TRAIN_ABI,
    functionName: "estimateLatestAppealCharge",
    args: [txId],
    blockNumber: identity.blockNumber
  });
  const quoteDecisionId = BigInt(_nullishCoalesce(quote.decisionId, () => ( quote[0])));
  if (quoteDecisionId !== identity.decisionId) {
    throw new Error(
      `Appeal decision changed while reading ${txId}: expected ${identity.decisionId}, received ${quoteDecisionId}`
    );
  }
  const bond = BigInt(_nullishCoalesce(quote.bond, () => ( quote[1])));
  const funding = BigInt(_nullishCoalesce(quote.funding, () => ( quote[2])));
  return { ...identity, requiredValue: bond + funding };
};
var _encodeTopUpFeesData = ({
  txId,
  distribution
}) => {
  return _viem.encodeFunctionData.call(void 0, {
    abi: CONSENSUS_FEE_MANAGEMENT_ABI,
    functionName: "topUpFees",
    args: [txId, createTopUpFeesDistribution(distribution)]
  });
};
var _encodeTopUpAndSubmitAppealData = ({
  txId,
  expectedDecisionId,
  distribution
}) => {
  return _viem.encodeFunctionData.call(void 0, {
    abi: CONSENSUS_FEE_MANAGEMENT_ABI,
    functionName: "topUpAndSubmitAppeal",
    args: [txId, expectedDecisionId, createFeesDistribution(distribution)]
  });
};
var _waitForSentEnvelope = async ({
  client,
  publicClient,
  evmHash,
  operationName,
  revertDetails
}) => {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: evmHash,
    ...client.chain.isStudio ? {
      // Studio returns the envelope hash before its EVM transaction index is
      // necessarily visible. viem's default six retries cover only ~12s and
      // Studio reports that transient as ResourceNotFoundRpcError.
      retryCount: 120,
      retryDelay: 500
    } : {}
  });
  if (receipt.status !== "reverted") return receipt;
  let studioReason;
  if (client.chain.isStudio) {
    try {
      const rawReceipt = await client.request({
        method: "eth_getTransactionReceipt",
        params: [evmHash]
      });
      const reason = _nullishCoalesce(_optionalChain([rawReceipt, 'optionalAccess', _79 => _79.revertReason]), () => ( _optionalChain([rawReceipt, 'optionalAccess', _80 => _80.error])));
      if (typeof reason === "string" && reason.trim() !== "") {
        studioReason = reason;
      }
    } catch (e3) {
    }
  }
  const details = _nullishCoalesce(studioReason, () => ( revertDetails));
  throw new Error(
    `${operationName} reverted: EVM tx ${evmHash}${details ? `. ${details}` : ""}`
  );
};
var _sendEvmContractCall = async ({
  client,
  publicClient,
  to,
  encodedData,
  senderAccount,
  value = 0n,
  operationName = "Contract call"
}) => {
  const validatedAccount = validateAccount(senderAccount);
  const nonce = await client.getCurrentNonce({ address: validatedAccount.address });
  let estimatedGas;
  try {
    estimatedGas = await client.estimateTransactionGas({
      from: validatedAccount.address,
      to,
      data: encodedData,
      value
    });
  } catch (err) {
    console.error("Gas estimation failed, using default 200_000:", err);
    estimatedGas = 200000n;
  }
  const gasPriceHex = await client.request({ method: "eth_gasPrice" });
  if (validatedAccount.type === "local") {
    if (!validatedAccount.signTransaction) {
      throw new Error("Local account does not support signTransaction.");
    }
    const txRequest = {
      account: validatedAccount,
      to,
      data: encodedData,
      value,
      gas: estimatedGas,
      gasPrice: BigInt(gasPriceHex),
      nonce,
      chainId: client.chain.id
    };
    const serializedTransaction = await validatedAccount.signTransaction(txRequest);
    const evmHash2 = await client.sendRawTransaction({ serializedTransaction });
    await _waitForSentEnvelope({ client, publicClient, evmHash: evmHash2, operationName });
    return evmHash2;
  }
  const evmHash = await client.request({
    method: "eth_sendTransaction",
    params: [{
      from: validatedAccount.address,
      to,
      data: encodedData,
      value: value ? `0x${value.toString(16)}` : void 0,
      gas: `0x${estimatedGas.toString(16)}`,
      nonce: `0x${BigInt(nonce).toString(16)}`,
      gasPrice: gasPriceHex
    }]
  });
  await _waitForSentEnvelope({ client, publicClient, evmHash, operationName });
  return evmHash;
};
var _sendConsensusCall = async ({
  client,
  publicClient,
  encodedData,
  senderAccount,
  value = 0n,
  operationName = "Consensus call"
}) => {
  if (!_optionalChain([client, 'access', _81 => _81.chain, 'access', _82 => _82.consensusMainContract, 'optionalAccess', _83 => _83.address])) {
    throw new Error("Consensus main contract not initialized.");
  }
  const validatedAccount = validateAccount(senderAccount);
  const nonce = await client.getCurrentNonce({ address: validatedAccount.address });
  let estimatedGas;
  try {
    estimatedGas = await client.estimateTransactionGas({
      to: client.chain.consensusMainContract.address,
      data: encodedData,
      value
    });
  } catch (err) {
    console.error("Gas estimation failed, using default 200_000:", err);
    estimatedGas = 200000n;
  }
  const gasPriceHex = await client.request({ method: "eth_gasPrice" });
  if (validatedAccount.type === "local") {
    if (!validatedAccount.signTransaction) {
      throw new Error("Local account does not support signTransaction.");
    }
    const txRequest = {
      account: validatedAccount,
      to: client.chain.consensusMainContract.address,
      data: encodedData,
      value,
      gas: estimatedGas,
      gasPrice: BigInt(gasPriceHex),
      nonce,
      chainId: client.chain.id
    };
    const serializedTransaction = await validatedAccount.signTransaction(txRequest);
    const evmHash2 = await client.sendRawTransaction({ serializedTransaction });
    await _waitForSentEnvelope({ client, publicClient, evmHash: evmHash2, operationName });
    return evmHash2;
  }
  const evmHash = await client.request({
    method: "eth_sendTransaction",
    params: [{
      from: validatedAccount.address,
      to: client.chain.consensusMainContract.address,
      data: encodedData,
      value: value ? `0x${value.toString(16)}` : void 0,
      gas: `0x${estimatedGas.toString(16)}`
    }]
  });
  await _waitForSentEnvelope({ client, publicClient, evmHash, operationName });
  return evmHash;
};
var extractTxIdFromLogs = (client, logs) => {
  const newTxEvents = _viem.parseEventLogs.call(void 0, {
    abi: _optionalChain([client, 'access', _84 => _84.chain, 'access', _85 => _85.consensusMainContract, 'optionalAccess', _86 => _86.abi]),
    eventName: "NewTransaction",
    logs
  });
  if (newTxEvents.length > 0) {
    return newTxEvents[0].args["txId"];
  }
  const createdTxEvents = _viem.parseEventLogs.call(void 0, {
    abi: CREATED_TRANSACTION_EVENT_ABI,
    eventName: "CreatedTransaction",
    logs
  });
  if (createdTxEvents.length > 0) {
    return createdTxEvents[0].args["txId"];
  }
  return null;
};
var _sendTransaction = async ({
  client,
  publicClient,
  transactionVariants,
  senderAccount
}) => {
  if (!_optionalChain([client, 'access', _87 => _87.chain, 'access', _88 => _88.consensusMainContract, 'optionalAccess', _89 => _89.address])) {
    throw new Error(`Consensus main contract address not found in chain config for "${client.chain.name}".`);
  }
  if (transactionVariants.length === 0) {
    throw new Error("No transaction variants available to send.");
  }
  const validatedSenderAccount = validateAccount(senderAccount);
  const nonce = await client.getCurrentNonce({ address: validatedSenderAccount.address });
  const knownRevertSelectorNames = {
    "0x8d53e553": "InsufficientFees",
    "0xb4132db3": "MaxPriceExceeded",
    "0x57df8523": "ExecutionBudgetExceeded",
    "0x305e533c": "BudgetTooLow",
    "0xa70732ee": "RollupBudgetBelowFloor",
    "0x632be5a1": "FeeValueMustBeNonZero"
  };
  const stringifyRpcError = (error) => {
    const parts = [];
    if (error instanceof Error) {
      parts.push(error.message);
    }
    const record = error && typeof error === "object" ? error : {};
    for (const key of ["details", "shortMessage", "data"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim() !== "") {
        parts.push(value);
      }
    }
    const cause = record.cause;
    if (cause && typeof cause === "object") {
      const causeRecord = cause;
      for (const key of ["message", "data"]) {
        const value = causeRecord[key];
        if (typeof value === "string" && value.trim() !== "") {
          parts.push(value);
        }
      }
    }
    const text = Array.from(new Set(parts)).join(" ");
    const selectorName = _optionalChain([Object, 'access', _90 => _90.entries, 'call', _91 => _91(knownRevertSelectorNames), 'access', _92 => _92.find, 'call', _93 => _93(([selector]) => text.includes(selector)), 'optionalAccess', _94 => _94[1]]);
    return selectorName && !text.includes(selectorName) ? `${text} (${selectorName})` : text;
  };
  const sendWithEncodedData = async (transactionVariant) => {
    let estimatedGas;
    let gasEstimationError;
    try {
      estimatedGas = await client.estimateTransactionGas({
        from: validatedSenderAccount.address,
        to: _optionalChain([client, 'access', _95 => _95.chain, 'access', _96 => _96.consensusMainContract, 'optionalAccess', _97 => _97.address]),
        data: transactionVariant.encodedData,
        value: transactionVariant.value
      });
      estimatedGas = withTransactionGasHeadroom(estimatedGas);
    } catch (err) {
      gasEstimationError = stringifyRpcError(err);
      console.error("Gas estimation failed, using default 200_000:", err);
      estimatedGas = 200000n;
    }
    if (_optionalChain([validatedSenderAccount, 'optionalAccess', _98 => _98.type]) === "local") {
      if (!_optionalChain([validatedSenderAccount, 'optionalAccess', _99 => _99.signTransaction])) {
        throw new Error("Local account does not support signTransaction. Use a private key account created via privateKeyToAccount().");
      }
      const gasPriceHex2 = await client.request({
        method: "eth_gasPrice"
      });
      const transactionRequest = {
        account: validatedSenderAccount,
        to: _optionalChain([client, 'access', _100 => _100.chain, 'access', _101 => _101.consensusMainContract, 'optionalAccess', _102 => _102.address]),
        data: transactionVariant.encodedData,
        type: "legacy",
        nonce: Number(nonce),
        value: transactionVariant.value,
        gas: estimatedGas,
        gasPrice: BigInt(gasPriceHex2),
        chainId: client.chain.id
      };
      const serializedTransaction = await validatedSenderAccount.signTransaction(transactionRequest);
      const txHash = await client.sendRawTransaction({ serializedTransaction });
      const receipt = await _waitForSentEnvelope({
        client,
        publicClient,
        evmHash: txHash,
        operationName: "Transaction",
        revertDetails: gasEstimationError ? `Gas estimation error: ${gasEstimationError}` : void 0
      });
      if (client.chain.isStudio) return txHash;
      const txId = extractTxIdFromLogs(client, receipt.logs);
      if (!txId) {
        throw new Error(
          `Transaction not processed by consensus: EVM tx ${txHash} succeeded but no NewTransaction or CreatedTransaction event was found in the receipt logs.`
        );
      }
      return txId;
    }
    let gasPriceHex;
    try {
      const gasPriceResult = await client.request({
        method: "eth_gasPrice"
      });
      if (typeof gasPriceResult === "string") {
        gasPriceHex = gasPriceResult;
      }
    } catch (error) {
      console.warn("Failed to fetch gas price, delegating gas price selection to wallet:", error);
    }
    const nonceBigInt = typeof nonce === "bigint" ? nonce : typeof nonce === "string" ? BigInt(nonce) : BigInt(Number(nonce));
    const formattedRequest = {
      from: validatedSenderAccount.address,
      to: _optionalChain([client, 'access', _103 => _103.chain, 'access', _104 => _104.consensusMainContract, 'optionalAccess', _105 => _105.address]),
      data: transactionVariant.encodedData,
      value: `0x${transactionVariant.value.toString(16)}`,
      gas: `0x${estimatedGas.toString(16)}`,
      nonce: `0x${nonceBigInt.toString(16)}`,
      type: "0x0",
      // legacy tx
      chainId: `0x${client.chain.id.toString(16)}`,
      ...gasPriceHex ? { gasPrice: gasPriceHex } : {}
    };
    const evmTxHash = await client.request({
      method: "eth_sendTransaction",
      params: [formattedRequest]
    });
    const externalReceipt = await _waitForSentEnvelope({
      client,
      publicClient,
      evmHash: evmTxHash,
      operationName: "Transaction",
      revertDetails: gasEstimationError ? `Gas estimation error: ${gasEstimationError}` : void 0
    });
    if (client.chain.isStudio) return evmTxHash;
    const externalTxId = extractTxIdFromLogs(client, externalReceipt.logs);
    if (!externalTxId) {
      throw new Error(
        `Transaction not processed by consensus: EVM tx ${evmTxHash} succeeded but no NewTransaction or CreatedTransaction event was found in the receipt logs.`
      );
    }
    return externalTxId;
  };
  if (transactionVariants.length !== 1) {
    throw new Error(`Train transaction encoding expected one variant, received ${transactionVariants.length}`);
  }
  return sendWithEncodedData(transactionVariants[0]);
};

// src/config/transactions.ts
var transactionsConfig = {
  waitInterval: 3e3,
  retries: 10
};

// src/utils/async.ts
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/transactions/actions.ts


// src/transactions/decoders.ts

var FIELDS_TO_REMOVE = [
  "raw",
  "contract_state",
  "base64",
  "consensus_history",
  "tx_data",
  "eq_blocks_outputs",
  "r",
  "s",
  "v",
  "created_timestamp",
  "current_timestamp",
  "tx_execution_hash",
  "random_seed",
  "states",
  "contract_code",
  "appeal_failed",
  "appeal_leader_timeout",
  "appeal_processing_time",
  "appeal_undetermined",
  "appealed",
  "timestamp_appeal",
  "config_rotation_rounds",
  "rotation_count",
  "queue_position",
  "queue_type",
  "leader_timeout_validators",
  "triggered_by",
  "num_of_initial_validators",
  "timestamp_awaiting_finalization",
  "last_vote_timestamp",
  "read_state_block_range",
  "tx_slot",
  "blockHash",
  "blockNumber",
  "to",
  "transactionIndex"
];
var FIELD_NAME_MAPPINGS = {
  statusName: "status_name",
  typeHex: "type"
};
var decodeInputData = (rlpEncodedAppData, recipient) => {
  if (!rlpEncodedAppData || rlpEncodedAppData === "0x" || rlpEncodedAppData.length <= 2) {
    return null;
  }
  try {
    const rlpDecodedArray = _viem.fromRlp.call(void 0, rlpEncodedAppData);
    if (rlpDecodedArray.length === 3) {
      return {
        code: _viem.fromHex.call(void 0, rlpDecodedArray[0], "string"),
        constructorArgs: rlpDecodedArray[1] && rlpDecodedArray[1] !== "0x" ? decode(_viem.fromHex.call(void 0, rlpDecodedArray[1], "bytes")) : null,
        leaderOnly: rlpDecodedArray[2] === "0x01",
        type: "deploy",
        contractAddress: recipient
      };
    } else if (rlpDecodedArray.length === 2) {
      return {
        callData: rlpDecodedArray[0] && rlpDecodedArray[0] !== "0x" ? decode(_viem.fromHex.call(void 0, rlpDecodedArray[0], "bytes")) : null,
        leaderOnly: rlpDecodedArray[1] === "0x01",
        type: "call"
      };
    } else {
      console.warn(
        "[decodeInputData] WRITE: Unexpected RLP array length:",
        rlpDecodedArray.length,
        rlpDecodedArray
      );
      return null;
    }
  } catch (e) {
    console.error(
      "[decodeInputData] Error during comprehensive decoding:",
      e,
      "Raw RLP App Data:",
      rlpEncodedAppData
    );
    return null;
  }
};
var decodeTransaction = (tx) => {
  const txDataDecoded = decodeInputData(tx.txCalldata, tx.recipient);
  const decodedTx = {
    ...tx,
    // Preserve the public SDK field names while decoding one canonical train
    // wire layout. Deployments with the old tuple must use the old SDK.
    txData: tx.txCalldata,
    txDataDecoded,
    currentTimestamp: tx.observedAt.toString(),
    numOfInitialValidators: tx.numOfInitialValidators.toString(),
    txSlot: tx.txSlot.toString(),
    createdTimestamp: tx.createdTimestamp.toString(),
    lastVoteTimestamp: tx.lastVoteTimestamp.toString(),
    queuePosition: tx.queuePosition.toString(),
    numOfRounds: tx.numOfRounds.toString(),
    readStateBlockRange: {
      ...tx.readStateBlockRange,
      activationBlock: _nullishCoalesce(_optionalChain([tx, 'access', _106 => _106.readStateBlockRange, 'optionalAccess', _107 => _107.activationBlock, 'optionalAccess', _108 => _108.toString, 'call', _109 => _109()]), () => ( "0")),
      processingBlock: _nullishCoalesce(_optionalChain([tx, 'access', _110 => _110.readStateBlockRange, 'optionalAccess', _111 => _111.processingBlock, 'optionalAccess', _112 => _112.toString, 'call', _113 => _113()]), () => ( "0")),
      proposalBlock: _nullishCoalesce(_optionalChain([tx, 'access', _114 => _114.readStateBlockRange, 'optionalAccess', _115 => _115.proposalBlock, 'optionalAccess', _116 => _116.toString, 'call', _117 => _117()]), () => ( "0"))
    },
    statusName: _chunkFKFYEOS7cjs.transactionsStatusNumberToName[String(tx.status)],
    lifecycle: _chunkFKFYEOS7cjs.transactionLifecycleFromStoredStatus.call(void 0, tx.status, tx.result),
    resultName: _chunkFKFYEOS7cjs.transactionResultNumberToName[String(tx.result)],
    txExecutionResult: tx.txExecutionResult !== void 0 ? Number(tx.txExecutionResult) : void 0,
    txExecutionResultName: tx.txExecutionResult !== void 0 ? _chunkFKFYEOS7cjs.executionResultNumberToName[String(tx.txExecutionResult)] : void 0,
    lastRound: {
      ...tx.lastRound,
      round: _nullishCoalesce(_optionalChain([tx, 'access', _118 => _118.lastRound, 'optionalAccess', _119 => _119.round, 'optionalAccess', _120 => _120.toString, 'call', _121 => _121()]), () => ( "0")),
      leaderIndex: _nullishCoalesce(_optionalChain([tx, 'access', _122 => _122.lastRound, 'optionalAccess', _123 => _123.leaderIndex, 'optionalAccess', _124 => _124.toString, 'call', _125 => _125()]), () => ( "0")),
      votesCommitted: _nullishCoalesce(_optionalChain([tx, 'access', _126 => _126.lastRound, 'optionalAccess', _127 => _127.votesCommitted, 'optionalAccess', _128 => _128.toString, 'call', _129 => _129()]), () => ( "0")),
      votesRevealed: _nullishCoalesce(_optionalChain([tx, 'access', _130 => _130.lastRound, 'optionalAccess', _131 => _131.votesRevealed, 'optionalAccess', _132 => _132.toString, 'call', _133 => _133()]), () => ( "0")),
      appealBond: _nullishCoalesce(_optionalChain([tx, 'access', _134 => _134.lastRound, 'optionalAccess', _135 => _135.appealBond, 'optionalAccess', _136 => _136.toString, 'call', _137 => _137()]), () => ( "0")),
      rotationsLeft: _nullishCoalesce(_optionalChain([tx, 'access', _138 => _138.lastRound, 'optionalAccess', _139 => _139.rotationsLeft, 'optionalAccess', _140 => _140.toString, 'call', _141 => _141()]), () => ( "0")),
      validatorVotesName: (_nullishCoalesce(_optionalChain([tx, 'access', _142 => _142.lastRound, 'optionalAccess', _143 => _143.validatorVotes]), () => ( []))).map(
        (vote) => _chunkFKFYEOS7cjs.voteTypeNumberToName[String(vote)]
      )
    }
  };
  return decodedTx;
};
var simplifyTransactionReceipt = (tx) => {
  const simplifyObject = (obj, path = "") => {
    if (obj === null || obj === void 0) return obj;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => simplifyObject(item, path)).filter((item) => item !== void 0);
    }
    if (typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (FIELDS_TO_REMOVE.includes(key)) {
          continue;
        }
        if (key === "node_config" && !path.includes("consensus_data")) {
          continue;
        }
        if (key === "consensus_data" && typeof value === "object" && value !== null) {
          const simplifiedConsensus = {};
          if ("votes" in value) {
            simplifiedConsensus.votes = value.votes;
          }
          if ("leader_receipt" in value && Array.isArray(value.leader_receipt)) {
            simplifiedConsensus.leader_receipt = value.leader_receipt.map((receipt) => {
              const simplifiedReceipt = {};
              ["execution_result", "genvm_result", "mode", "vote", "node_config"].forEach((field) => {
                if (field in receipt) {
                  simplifiedReceipt[field] = receipt[field];
                }
              });
              if (receipt.calldata && typeof receipt.calldata === "object" && "readable" in receipt.calldata) {
                simplifiedReceipt.calldata = { readable: receipt.calldata.readable };
              }
              if (receipt.eq_outputs) {
                simplifiedReceipt.eq_outputs = simplifyObject(receipt.eq_outputs, currentPath);
              }
              if (receipt.result !== void 0) {
                simplifiedReceipt.result = simplifyObject(receipt.result, currentPath);
              }
              return simplifiedReceipt;
            });
          }
          if ("validators" in value && Array.isArray(value.validators)) {
            const simplifiedValidators = value.validators.map((validator) => {
              const simplifiedValidator = {};
              ["execution_result", "genvm_result", "mode", "vote", "node_config"].forEach((field) => {
                if (field in validator) {
                  simplifiedValidator[field] = validator[field];
                }
              });
              return simplifiedValidator;
            }).filter((validator) => Object.keys(validator).length > 0);
            if (simplifiedValidators.length > 0) {
              simplifiedConsensus.validators = simplifiedValidators;
            }
          }
          result[key] = simplifiedConsensus;
          continue;
        }
        const simplifiedValue = simplifyObject(value, currentPath);
        const shouldInclude = simplifiedValue !== void 0 && !(typeof simplifiedValue === "object" && simplifiedValue !== null && Object.keys(simplifiedValue).length === 0);
        if (shouldInclude || simplifiedValue === 0) {
          const mappedKey = FIELD_NAME_MAPPINGS[key] || key;
          result[mappedKey] = simplifiedValue;
        }
      }
      return result;
    }
    return obj;
  };
  return simplifyObject({ ...tx });
};
var decodeLocalnetTransaction = (tx) => {
  if (!tx.data) return tx;
  try {
    const leaderReceipt = _optionalChain([tx, 'access', _144 => _144.consensus_data, 'optionalAccess', _145 => _145.leader_receipt]);
    if (leaderReceipt) {
      const receipts = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
      receipts.forEach((receipt) => {
        if (receipt.result && typeof receipt.result === "string") {
          receipt.result = resultToUserFriendlyJson(receipt.result);
        }
        if (receipt.calldata && typeof receipt.calldata === "string") {
          receipt.calldata = {
            base64: receipt.calldata,
            ...calldataToUserFriendlyJson(b64ToArray(receipt.calldata))
          };
        }
        if (receipt.eq_outputs) {
          const decodedOutputs = {};
          for (const [key, value] of Object.entries(receipt.eq_outputs)) {
            if (typeof value === "object" && value !== null) {
              decodedOutputs[key] = value;
            } else {
              try {
                decodedOutputs[key] = resultToUserFriendlyJson(value);
              } catch (e) {
                console.warn(`Error decoding eq_output ${key}: ${e}`);
                decodedOutputs[key] = value;
              }
            }
          }
          receipt.eq_outputs = decodedOutputs;
        }
      });
    }
    if (_optionalChain([tx, 'access', _146 => _146.data, 'optionalAccess', _147 => _147.calldata]) && typeof tx.data.calldata === "string") {
      tx.data.calldata = {
        base64: tx.data.calldata,
        ...calldataToUserFriendlyJson(b64ToArray(tx.data.calldata))
      };
    }
  } catch (e) {
    console.error("Error in decodeLocalnetTransaction:", e);
  }
  return tx;
};

// src/transactions/lifecycleFallback.ts

var METHOD_NOT_FOUND_CODE = -32601;
var METHOD_NOT_FOUND_MESSAGE = /method not found|does not exist|method not supported/i;
var STUDIO_ACTIVATED_STATUS = "ACTIVATED";
var isMethodNotFoundError = (error) => {
  if (error instanceof _viem.MethodNotFoundRpcError) return true;
  const seen = /* @__PURE__ */ new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { code, message } = current;
    if (Number(code) === METHOD_NOT_FOUND_CODE) return true;
    if (typeof message === "string" && METHOD_NOT_FOUND_MESSAGE.test(message)) return true;
    current = current.cause;
  }
  return false;
};
var NO_OP_RESOLUTION_ACTION_CODE = 0;
var UNSPECIFIED_RESOLUTION_SOURCE_CODE = 0;
var storedStatusName = (transaction) => {
  const raw = _nullishCoalesce(transaction.statusName, () => ( transaction.status));
  const byCode = (code) => Object.prototype.hasOwnProperty.call(_chunkFKFYEOS7cjs.transactionsStatusNumberToName, code) ? _chunkFKFYEOS7cjs.transactionsStatusNumberToName[code] : void 0;
  if (typeof raw === "number") return byCode(String(raw));
  if (typeof raw !== "string") return void 0;
  if (raw === STUDIO_ACTIVATED_STATUS) return "PENDING" /* PENDING */;
  if (/^\d+$/.test(raw)) return byCode(raw);
  return Object.prototype.hasOwnProperty.call(_chunkFKFYEOS7cjs.transactionsStatusNameToNumber, raw) ? raw : void 0;
};
var readStudioLifecycleFallback = async ({
  client,
  hash,
  timestamp,
  cause
}) => {
  let transaction;
  try {
    transaction = await client.getTransaction({ hash });
  } catch (e4) {
    throw cause;
  }
  const status = storedStatusName(transaction);
  if (!status) throw cause;
  const storedStatusCode = Number(_chunkFKFYEOS7cjs.transactionsStatusNameToNumber[status]);
  return {
    storedStatusCode,
    // The consumer surface cannot project a status forward in time.
    projectedStatusCode: storedStatusCode,
    resolutionActionCode: NO_OP_RESOLUTION_ACTION_CODE,
    resolutionSourceCode: UNSPECIFIED_RESOLUTION_SOURCE_CODE,
    decisionId: null,
    decisionActive: false,
    evaluatedAt: _nullishCoalesce(timestamp, () => ( Math.floor(Date.now() / 1e3)))
  };
};

// src/transactions/actions.ts
var TRANSACTION_PAGE_SIZE = 64n;
var protocolInteger = (value, label) => {
  if (value === null || value === void 0 || value === "") {
    throw new Error(`Missing protocol lifecycle ${label}`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid protocol lifecycle ${label}: ${String(value)}`);
  }
  return numeric;
};
var protocolName = (names, code, label) => {
  const name = names[String(code)];
  if (!name) throw new Error(`Unknown protocol lifecycle ${label}: ${code}`);
  return name;
};
var protocolDecisionId = (value, active) => {
  if (!active) return null;
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`Invalid protocol lifecycle decisionId: ${String(value)}`);
  }
  const decimal = String(value);
  if (!/^\d+$/.test(decimal)) {
    throw new Error(`Invalid protocol lifecycle decisionId: ${decimal}`);
  }
  return BigInt(decimal).toString();
};
var normalizeProtocolLifecycle = (raw) => {
  const storedStatusCode = protocolInteger(raw.storedStatusCode, "storedStatusCode");
  const projectedStatusCode = protocolInteger(raw.projectedStatusCode, "projectedStatusCode");
  const resolutionActionCode = protocolInteger(raw.resolutionActionCode, "resolutionActionCode");
  const resolutionSourceCode = protocolInteger(raw.resolutionSourceCode, "resolutionSourceCode");
  if (typeof raw.decisionActive !== "boolean") {
    throw new Error(`Invalid protocol lifecycle decisionActive: ${String(raw.decisionActive)}`);
  }
  return {
    storedStatus: protocolName(_chunkFKFYEOS7cjs.transactionProtocolStatusNumberToName, storedStatusCode, "storedStatusCode"),
    storedStatusCode,
    projectedStatus: protocolName(
      _chunkFKFYEOS7cjs.transactionProtocolStatusNumberToName,
      projectedStatusCode,
      "projectedStatusCode"
    ),
    projectedStatusCode,
    resolutionAction: protocolName(
      _chunkFKFYEOS7cjs.transactionResolutionActionNumberToName,
      resolutionActionCode,
      "resolutionActionCode"
    ),
    resolutionActionCode,
    resolutionSource: protocolName(
      _chunkFKFYEOS7cjs.transactionResolutionSourceNumberToName,
      resolutionSourceCode,
      "resolutionSourceCode"
    ),
    resolutionSourceCode,
    decisionId: protocolDecisionId(raw.decisionId, raw.decisionActive),
    decisionActive: raw.decisionActive,
    evaluatedAt: protocolInteger(raw.evaluatedAt, "evaluatedAt")
  };
};
var resolvedAddress = (name, address) => {
  if (address === _viem.zeroAddress) {
    throw new Error(`${name} is not registered in AddressManager`);
  }
  return address;
};
var unpackAddressPage = (result) => "page" in result ? result : { page: result[0], total: result[1] };
var readAddressPages = async (total, readPage) => {
  const offsets = [];
  for (let offset = 0n; offset < total; offset += TRANSACTION_PAGE_SIZE) offsets.push(offset);
  const pages = (await Promise.all(offsets.map(readPage))).map(unpackAddressPage);
  if (pages.some((page) => page.total !== total)) {
    throw new Error("Address page total changed within a fixed block snapshot");
  }
  const items = pages.flatMap(({ page }) => [...page]);
  if (BigInt(items.length) !== total) {
    throw new Error(`Incomplete address pages: expected ${total}, received ${items.length}`);
  }
  return items;
};
var didWarnWaitForTransactionReceiptStatus = false;
var warnDeprecatedReceiptStatus = () => {
  if (didWarnWaitForTransactionReceiptStatus) return;
  didWarnWaitForTransactionReceiptStatus = true;
  console.warn("waitForTransactionReceipt({ status }) is deprecated; use waitUntil: 'decided' or waitUntil: 'finalized' instead.");
};
var resolveWaitTarget = (status, waitUntil) => {
  if (waitUntil) {
    return { waitUntil, label: waitUntil };
  }
  if (!status) {
    return { waitUntil: "decided", label: "decided" };
  }
  warnDeprecatedReceiptStatus();
  if (status === "ACCEPTED" /* ACCEPTED */) {
    return { waitUntil: "decided", label: "decided" };
  }
  if (status === "FINALIZED" /* FINALIZED */) {
    return { waitUntil: "finalized", label: "finalized" };
  }
  return { legacyStatus: status, label: status };
};
var hasReachedWaitTarget = (transaction, target) => {
  const storedStatusName2 = _nullishCoalesce(transaction.statusName, () => ( (typeof transaction.status === "number" || /^\d+$/.test(String(transaction.status)) ? _chunkFKFYEOS7cjs.transactionsStatusNumberToName[String(transaction.status)] : transaction.status)));
  const transactionStatusString = storedStatusName2 ? _chunkFKFYEOS7cjs.transactionsStatusNameToNumber[storedStatusName2] : String(transaction.status);
  if (target.waitUntil === "decided") {
    return _chunkFKFYEOS7cjs.isDecidedState.call(void 0, transactionStatusString);
  }
  if (target.waitUntil === "finalized") {
    return transactionStatusString === _chunkFKFYEOS7cjs.transactionsStatusNameToNumber["FINALIZED" /* FINALIZED */];
  }
  if (!target.legacyStatus) return false;
  return transactionStatusString === _chunkFKFYEOS7cjs.transactionsStatusNameToNumber[target.legacyStatus];
};
var isSuccessful = (transaction) => {
  const statusName = _nullishCoalesce(transaction.statusName, () => ( (typeof transaction.status === "string" && transaction.status in _chunkFKFYEOS7cjs.TransactionStatus ? transaction.status : transaction.status === void 0 ? void 0 : _chunkFKFYEOS7cjs.transactionsStatusNumberToName[String(transaction.status)])));
  const executionResultName = _nullishCoalesce(transaction.txExecutionResultName, () => ( (transaction.txExecutionResult === void 0 ? void 0 : _chunkFKFYEOS7cjs.executionResultNumberToName[String(transaction.txExecutionResult)])));
  return (statusName === "ACCEPTED" /* ACCEPTED */ || statusName === "FINALIZED" /* FINALIZED */) && executionResultName === "FINISHED_WITH_RETURN" /* FINISHED_WITH_RETURN */;
};
var receiptActions = (client, publicClient) => ({
  /** Polls until a transaction reaches the specified status. Returns the transaction receipt. */
  waitForTransactionReceipt: async ({
    hash,
    status,
    waitUntil,
    interval = transactionsConfig.waitInterval,
    retries = transactionsConfig.retries,
    fullTransaction = false
  }) => {
    const target = resolveWaitTarget(status, waitUntil);
    const transaction = await client.getTransaction({
      hash
    });
    if (!transaction) {
      throw new Error(`Transaction not found: ${hash}`);
    }
    const transactionStatusString = String(transaction.status);
    if (hasReachedWaitTarget(transaction, target)) {
      let finalTransaction = transaction;
      if (client.chain.isStudio) {
        finalTransaction = decodeLocalnetTransaction(transaction);
      }
      if (!fullTransaction) {
        return simplifyTransactionReceipt(finalTransaction);
      }
      return finalTransaction;
    }
    if (retries === 0) {
      throw new Error(`Timed out waiting for transaction ${hash} to reach "${target.label}" (current status: ${transactionStatusString}).`);
    }
    await sleep(interval);
    return receiptActions(client, publicClient).waitForTransactionReceipt({
      hash,
      waitUntil: target.waitUntil,
      status: target.legacyStatus,
      interval,
      retries: retries - 1,
      fullTransaction
    });
  },
  /** Polls until the stored transaction state contains a materialized decision. */
  waitForDecision: async ({
    hash,
    interval,
    retries,
    fullTransaction
  }) => receiptActions(client, publicClient).waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    interval,
    retries,
    fullTransaction
  }),
  /** Polls until the stored transaction state is finalized. */
  waitForFinalization: async ({
    hash,
    interval,
    retries,
    fullTransaction
  }) => receiptActions(client, publicClient).waitForTransactionReceipt({
    hash,
    waitUntil: "finalized",
    interval,
    retries,
    fullTransaction
  })
});
var transactionActions = (client, publicClient) => ({
  advanced: {
    /**
     * `advanced.getTransactionLifecycle` exposes stored/projected status,
     * resolution action/source, and active decision identity. Contract networks
     * use one fixed-block lifecycle read. `Finalize` is an action, not a status
     * or separate readiness field.
     *
     * A Studio deployment that does not yet serve `gen_getTransactionLifecycle`
     * degrades to the stored status its consumer surface does prove, rather
     * than failing the whole read.
     */
    getTransactionLifecycle: async ({
      hash,
      timestamp
    }) => {
      if (client.chain.isStudio) {
        let raw;
        try {
          raw = await client.request({
            method: "gen_getTransactionLifecycle",
            params: [{ txId: hash, ...timestamp === void 0 ? {} : {
              timestamp: protocolInteger(timestamp, "timestamp")
            } }]
          });
        } catch (error) {
          if (!isMethodNotFoundError(error)) throw error;
          raw = await readStudioLifecycleFallback({ client, hash, timestamp, cause: error });
        }
        return normalizeProtocolLifecycle(raw);
      }
      const consensusDataAddress = _optionalChain([client, 'access', _148 => _148.chain, 'access', _149 => _149.consensusDataContract, 'optionalAccess', _150 => _150.address]);
      if (!consensusDataAddress || consensusDataAddress === _viem.zeroAddress) {
        throw new Error("ConsensusData contract is not configured for this chain");
      }
      const snapshot = await publicClient.getBlock();
      const blockNumber = snapshot.number;
      const evaluatedAt = timestamp === void 0 ? protocolInteger(snapshot.timestamp, "block timestamp") : protocolInteger(timestamp, "timestamp");
      const lifecycle = await publicClient.readContract({
        address: consensusDataAddress,
        abi: CONSENSUS_DATA_TRAIN_ABI,
        functionName: "getTransactionLifecycle",
        args: [hash, BigInt(evaluatedAt)],
        blockNumber
      });
      return normalizeProtocolLifecycle({
        storedStatusCode: lifecycle.storedStatus,
        projectedStatusCode: lifecycle.resolution.projectedStatus,
        resolutionActionCode: lifecycle.resolution.action,
        resolutionSourceCode: lifecycle.resolution.source,
        decisionId: lifecycle.latestDecision.decisionId,
        decisionActive: lifecycle.decisionActive,
        evaluatedAt: lifecycle.resolution.evaluatedAt
      });
    }
  },
  /**
   * Fetches a transaction with a simple stored lifecycle and split round data.
   * Use advanced.getTransactionLifecycle for protocol projection/action details.
   */
  getTransaction: async ({ hash }) => {
    if (client.chain.isStudio) {
      const transaction2 = await client.getTransaction({ hash });
      const localnetStatus = transaction2.status === "ACTIVATED" ? "PENDING" /* PENDING */ : transaction2.status;
      transaction2.status = Number(_chunkFKFYEOS7cjs.transactionsStatusNameToNumber[localnetStatus]);
      transaction2.statusName = localnetStatus;
      transaction2.lifecycle = _chunkFKFYEOS7cjs.transactionLifecycleFromStoredStatus.call(void 0, 
        localnetStatus,
        transaction2.result
      );
      return decodeLocalnetTransaction(transaction2);
    }
    const consensusDataAddress = _optionalChain([client, 'access', _151 => _151.chain, 'access', _152 => _152.consensusDataContract, 'optionalAccess', _153 => _153.address]);
    if (!consensusDataAddress || consensusDataAddress === _viem.zeroAddress) {
      throw new Error("ConsensusData contract is not configured for this chain");
    }
    const snapshot = await publicClient.getBlock();
    const blockNumber = snapshot.number;
    const addressManagerAddress = resolvedAddress(
      "AddressManager",
      await publicClient.readContract({
        address: consensusDataAddress,
        abi: CONSENSUS_DATA_TRAIN_ABI,
        functionName: "addressManager",
        blockNumber
      })
    );
    const [bigRoundsAddressRaw, roundsStorageAddressRaw, transactionManagerAddressRaw] = await Promise.all([
      publicClient.readContract({
        address: addressManagerAddress,
        abi: ADDRESS_MANAGER_TRAIN_ABI,
        functionName: "getAddress",
        args: ["ConsensusDataBigRounds"],
        blockNumber
      }),
      publicClient.readContract({
        address: addressManagerAddress,
        abi: ADDRESS_MANAGER_TRAIN_ABI,
        functionName: "getAddress",
        args: ["RoundsStorage"],
        blockNumber
      }),
      publicClient.readContract({
        address: addressManagerAddress,
        abi: ADDRESS_MANAGER_TRAIN_ABI,
        functionName: "getAddress",
        args: ["TransactionManager"],
        blockNumber
      })
    ]);
    const bigRoundsAddress = resolvedAddress("ConsensusDataBigRounds", bigRoundsAddressRaw);
    const roundsStorageAddress = resolvedAddress("RoundsStorage", roundsStorageAddressRaw);
    const transactionManagerAddress = resolvedAddress("TransactionManager", transactionManagerAddressRaw);
    const txData = await publicClient.readContract({
      address: bigRoundsAddress,
      abi: CONSENSUS_DATA_BIG_ROUNDS_TRAIN_ABI,
      functionName: "getStoredTransactionDataLight",
      args: [hash],
      blockNumber
    });
    const round = txData.lastRound.round;
    const [roundValidators, consumedValidators, validatorVotes, validatorVotesHash, validatorResultHash, txExecutionResult, numOfInitialValidators] = await Promise.all([
      readAddressPages(txData.lastRound.validatorsCount, (offset) => publicClient.readContract({
        address: bigRoundsAddress,
        abi: CONSENSUS_DATA_BIG_ROUNDS_TRAIN_ABI,
        functionName: "getRoundValidatorsPaged",
        args: [hash, round, offset, TRANSACTION_PAGE_SIZE],
        blockNumber
      })),
      readAddressPages(txData.consumedValidatorsCount, (offset) => publicClient.readContract({
        address: bigRoundsAddress,
        abi: CONSENSUS_DATA_BIG_ROUNDS_TRAIN_ABI,
        functionName: "getConsumedValidatorsPaged",
        args: [hash, offset, TRANSACTION_PAGE_SIZE],
        blockNumber
      })),
      publicClient.readContract({
        address: roundsStorageAddress,
        abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
        functionName: "getValidatorVotes",
        args: [hash, round],
        blockNumber
      }),
      publicClient.readContract({
        address: roundsStorageAddress,
        abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
        functionName: "getValidatorVotesHash",
        args: [hash, round],
        blockNumber
      }),
      publicClient.readContract({
        address: roundsStorageAddress,
        abi: ROUNDS_STORAGE_TRAIN_READ_ABI,
        functionName: "getValidatorResultHash",
        args: [hash, round],
        blockNumber
      }),
      publicClient.readContract({
        address: transactionManagerAddress,
        abi: TRANSACTION_MANAGER_TRAIN_READ_ABI,
        functionName: "getTxExecutionResult",
        args: [hash],
        blockNumber
      }),
      publicClient.readContract({
        address: transactionManagerAddress,
        abi: TRANSACTION_MANAGER_TRAIN_READ_ABI,
        functionName: "getNumOfInitialValidators",
        args: [hash],
        blockNumber
      })
    ]);
    const transaction = {
      ...txData,
      numOfInitialValidators,
      txExecutionResult: Number(txExecutionResult),
      consumedValidators,
      lastRound: {
        ...txData.lastRound,
        roundValidators,
        validatorVotes: [...validatorVotes].map(Number),
        validatorVotesHash: [...validatorVotesHash],
        validatorResultHash: [...validatorResultHash]
      }
    };
    return decodeTransaction(transaction);
  },
  /** Returns transaction IDs of child transactions created from emitted messages. */
  getTriggeredTransactionIds: async ({ hash }) => {
    if (client.chain.isStudio) {
      const tx2 = await client.getTransaction({ hash });
      return _nullishCoalesce(tx2.triggered_transactions, () => ( []));
    }
    const tx = await transactionActions(client, publicClient).getTransaction({ hash });
    const proposalBlock = BigInt(_nullishCoalesce(_optionalChain([tx, 'access', _154 => _154.readStateBlockRange, 'optionalAccess', _155 => _155.proposalBlock]), () => ( "0")));
    if (proposalBlock === BigInt(0)) return [];
    const scanRange = BigInt(1e4);
    const latestBlock = await publicClient.getBlockNumber();
    const toBlock = proposalBlock + scanRange < latestBlock ? proposalBlock + scanRange : latestBlock;
    const consensusAddress = _optionalChain([client, 'access', _156 => _156.chain, 'access', _157 => _157.consensusMainContract, 'optionalAccess', _158 => _158.address]);
    const internalMessageProcessedTopic = _viem.keccak256.call(void 0, _viem.stringToBytes.call(void 0, "InternalMessageProcessed(bytes32,address,address)"));
    const transactionAcceptedTopic = _viem.keccak256.call(void 0, _viem.stringToBytes.call(void 0, "TransactionAccepted(bytes32)"));
    const transactionFinalizedTopic = _viem.keccak256.call(void 0, _viem.stringToBytes.call(void 0, "TransactionFinalized(bytes32)"));
    const decisionLogs = await publicClient.getLogs({
      address: consensusAddress,
      event: void 0,
      fromBlock: proposalBlock,
      toBlock,
      topics: [[transactionAcceptedTopic, transactionFinalizedTopic], hash]
    });
    const decisionTransactionHashes = [
      ...new Set(decisionLogs.map((log) => log.transactionHash).filter(Boolean))
    ];
    const receipts = await Promise.all(
      decisionTransactionHashes.map(
        (transactionHash) => publicClient.getTransactionReceipt({ hash: transactionHash })
      )
    );
    return [
      ...new Set(
        receipts.flatMap(
          (receipt) => receipt.logs.filter((log) => log.topics[0] === internalMessageProcessedTopic).map((log) => log.topics[1]).filter(Boolean)
        )
      )
    ];
  },
  /** Fetches the full execution trace including return data, stdout, stderr, and GenVM logs. */
  debugTraceTransaction: async ({ hash, round = 0 }) => {
    const result = await client.request({
      method: "gen_dbg_traceTransaction",
      params: [{ txID: hash, round }]
    });
    return result;
  },
  /** Cancels a pending transaction. Studio networks only. */
  cancelTransaction: async ({ hash }) => {
    if (!client.chain.isStudio) {
      throw new Error("cancelTransaction is only available on studio-based chains (localnet/studionet)");
    }
    if (!client.account) {
      throw new Error("No account set. Configure the client with an account to cancel transactions.");
    }
    const messageHash = _viem.keccak256.call(void 0, _viem.concat.call(void 0, [_viem.stringToBytes.call(void 0, "cancel_transaction"), _viem.toBytes.call(void 0, hash)]));
    let signature;
    if (typeof client.account === "object" && "signMessage" in client.account) {
      signature = await client.account.signMessage({ message: { raw: messageHash } });
    } else {
      const provider = typeof window !== "undefined" ? window.ethereum : void 0;
      if (!provider) {
        throw new Error("No provider available for signing. Use a private key account or ensure a wallet is connected.");
      }
      const address = typeof client.account === "string" ? client.account : client.account.address;
      signature = await provider.request({
        method: "personal_sign",
        params: [messageHash, address]
      });
    }
    return client.request({
      method: "sim_cancelTransaction",
      params: [hash, signature]
    });
  },
  /** Returns the queue slot position of a transaction in the pending queue. */
  getTransactionQueuePosition: async ({ hash }) => {
    const consensusAddress = _optionalChain([client, 'access', _159 => _159.chain, 'access', _160 => _160.consensusMainContract, 'optionalAccess', _161 => _161.address]);
    const consensusAbi = _optionalChain([client, 'access', _162 => _162.chain, 'access', _163 => _163.consensusMainContract, 'optionalAccess', _164 => _164.abi]);
    const queuesAddress = await publicClient.readContract({
      address: consensusAddress,
      abi: consensusAbi,
      functionName: "queues"
    });
    const QUEUES_ABI = [
      {
        inputs: [{ internalType: "bytes32", name: "txId", type: "bytes32" }],
        name: "getTransactionQueuePosition",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ];
    const position = await publicClient.readContract({
      address: queuesAddress,
      abi: QUEUES_ABI,
      functionName: "getTransactionQueuePosition",
      args: [hash]
    });
    return Number(position);
  },
  /** Estimates gas required for a transaction. */
  estimateTransactionGas: async (transactionParams) => {
    const formattedParams = {
      from: transactionParams.from || _optionalChain([client, 'access', _165 => _165.account, 'optionalAccess', _166 => _166.address]),
      to: transactionParams.to,
      data: transactionParams.data || "0x",
      value: transactionParams.value ? `0x${transactionParams.value.toString(16)}` : "0x0"
    };
    const gasHex = await client.request({
      method: "eth_estimateGas",
      params: [formattedParams]
    });
    return BigInt(gasHex);
  }
});

// src/config/snapID.ts
var snapID = {
  local: "local:http://localhost:8081",
  npm: "npm:genlayer-wallet-plugin"
};

// src/wallet/connect.ts
var networks = {
  localnet: _chunkNUO3HSVBcjs.localnet,
  studionet: _chunkNUO3HSVBcjs.studionet,
  studioDevnet: _chunkNUO3HSVBcjs.studioDevnet,
  testnetAsimov: _chunkNUO3HSVBcjs.testnetAsimov,
  testnetBradbury: _chunkNUO3HSVBcjs.testnetBradbury
};
var connect = async (client, network = "studionet", snapSource = "npm") => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }
  if (network === "mainnet") {
    throw new Error(`${network} is not available yet. Please use localnet.`);
  }
  const selectedNetwork = networks[network];
  if (!selectedNetwork) {
    throw new Error(`Network configuration for '${network}' is not available.`);
  }
  const chainIdHex = `0x${selectedNetwork.id.toString(16)}`;
  const chainParams = {
    chainId: chainIdHex,
    chainName: selectedNetwork.name,
    rpcUrls: selectedNetwork.rpcUrls.default.http,
    nativeCurrency: selectedNetwork.nativeCurrency,
    blockExplorerUrls: [_optionalChain([selectedNetwork, 'access', _167 => _167.blockExplorers, 'optionalAccess', _168 => _168.default, 'access', _169 => _169.url])]
  };
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChainId !== chainIdHex) {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [chainParams]
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  }
  const id = snapSource === "local" ? snapID.local : snapID.npm;
  const installedSnaps = await window.ethereum.request({ method: "wallet_getSnaps" });
  const isGenLayerSnapInstalled = Object.values(installedSnaps).some((snap) => snap.id === id);
  if (!isGenLayerSnapInstalled) {
    await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [id]: {}
      }
    });
  }
  client.chain = selectedNetwork;
};

// src/wallet/metamaskClient.ts
var metamaskClient = async (snapSource = "npm") => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }
  const isFlask = async () => {
    try {
      const clientVersion = await _optionalChain([window, 'access', _170 => _170.ethereum, 'optionalAccess', _171 => _171.request, 'call', _172 => _172({
        method: "web3_clientVersion"
      })]);
      return _optionalChain([clientVersion, 'optionalAccess', _173 => _173.includes, 'call', _174 => _174("flask")]);
    } catch (error) {
      console.error("Error detecting Flask:", error);
      return false;
    }
  };
  const installedSnaps = async () => {
    try {
      return await _optionalChain([window, 'access', _175 => _175.ethereum, 'optionalAccess', _176 => _176.request, 'call', _177 => _177({
        method: "wallet_getSnaps"
      })]);
    } catch (error) {
      console.error("Error getting installed snaps:", error);
      return {};
    }
  };
  const isGenLayerSnapInstalled = async () => {
    const id = snapSource === "local" ? snapID.local : snapID.npm;
    const snaps = await installedSnaps();
    return Object.values(snaps).some((snap) => snap.id === id);
  };
  const flaskDetected = await isFlask();
  const snapsList = await installedSnaps();
  const genLayerSnapInstalled = await isGenLayerSnapInstalled();
  return {
    isFlask: flaskDetected,
    installedSnaps: snapsList,
    isGenLayerSnapInstalled: genLayerSnapInstalled
  };
};

// src/wallet/actions.ts
function walletActions(client) {
  return {
    connect: (network, snapSource) => connect(client, network, snapSource),
    metamaskClient: (snapSource = "npm") => metamaskClient(snapSource)
  };
}

// src/staking/actions.ts


// src/staking/utils.ts

function parseStakingAmount(amount) {
  if (typeof amount === "bigint") return amount;
  const trimmed = amount.trim();
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("gen")) {
    return _viem.parseEther.call(void 0, lower.slice(0, -3).trim());
  }
  return BigInt(trimmed);
}
function formatStakingAmount(amount) {
  return `${_viem.formatEther.call(void 0, amount)} GEN`;
}

// src/vesting/operatorRegistration.ts











var _accounts = require('viem/accounts');
var OPERATOR_REGISTRATION_DOMAIN = _viem.keccak256.call(void 0, 
  _viem.stringToHex.call(void 0, "GenLayer/operatorPubKey/proof-of-possession/v1")
);
function operatorAddressFromPublicKey(operatorPubKey) {
  const publicKey = _viem.concatHex.call(void 0, [
    "0x04",
    _viem.toHex.call(void 0, operatorPubKey[0], { size: 32 }),
    _viem.toHex.call(void 0, operatorPubKey[1], { size: 32 })
  ]);
  return _viem.getAddress.call(void 0, _accounts.publicKeyToAddress.call(void 0, publicKey));
}
function operatorPossessionMessage(operatorPubKey, context) {
  return _viem.keccak256.call(void 0, 
    _viem.encodeAbiParameters.call(void 0, 
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" }
      ],
      [
        OPERATOR_REGISTRATION_DOMAIN,
        context.chainId,
        context.registrar,
        context.owner,
        operatorPubKey[0],
        operatorPubKey[1]
      ]
    )
  );
}
async function createOperatorRegistration(options) {
  const account = _accounts.privateKeyToAccount.call(void 0, options.privateKey);
  const operatorPubKey = [
    _viem.hexToBigInt.call(void 0, _viem.sliceHex.call(void 0, account.publicKey, 1, 33)),
    _viem.hexToBigInt.call(void 0, _viem.sliceHex.call(void 0, account.publicKey, 33, 65))
  ];
  const operator = operatorAddressFromPublicKey(operatorPubKey);
  if (operator !== _viem.getAddress.call(void 0, account.address)) {
    throw new Error("Operator private key and public key derive different identities.");
  }
  const possessionProof = await account.signMessage({
    message: { raw: operatorPossessionMessage(operatorPubKey, options) }
  });
  return { operator, operatorPubKey, possessionProof };
}
async function verifyOperatorRegistration(registration, context) {
  try {
    const operator = operatorAddressFromPublicKey(registration.operatorPubKey);
    if (operator !== _viem.getAddress.call(void 0, registration.operator)) return false;
    const recovered = await _viem.recoverMessageAddress.call(void 0, {
      message: { raw: operatorPossessionMessage(registration.operatorPubKey, context) },
      signature: registration.possessionProof
    });
    return _viem.getAddress.call(void 0, recovered) === operator;
  } catch (e5) {
    return false;
  }
}

// src/staking/actions.ts
var VALIDATORS_JOINED_PAGE_SIZE = 64n;
var FALLBACK_GAS = 1000000n;
var GAS_BUFFER_MULTIPLIER = 2n;
var VALIDATOR_WALLET_FACTORY_KEY = "ValidatorWalletFactory";
var COMBINED_ERROR_ABI = [..._chunkNUO3HSVBcjs.STAKING_ABI, ..._chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI];
function extractRevertReason(err) {
  if (err instanceof _viem.BaseError) {
    const rawError = err.walk((e) => e instanceof _viem.RawContractError);
    if (rawError instanceof _viem.RawContractError && rawError.data && typeof rawError.data === "string") {
      try {
        const decoded = _viem.decodeErrorResult.call(void 0, {
          abi: COMBINED_ERROR_ABI,
          data: rawError.data
        });
        return decoded.errorName;
      } catch (e6) {
      }
    }
    let current = err;
    while (current) {
      if (current && typeof current === "object") {
        const obj = current;
        if (obj.data && typeof obj.data === "string" && obj.data.startsWith("0x")) {
          try {
            const decoded = _viem.decodeErrorResult.call(void 0, {
              abi: COMBINED_ERROR_ABI,
              data: obj.data
            });
            return decoded.errorName;
          } catch (e7) {
          }
        }
        current = obj.cause;
      } else {
        break;
      }
    }
    const revertError = err.walk((e) => e instanceof _viem.ContractFunctionRevertedError);
    if (revertError instanceof _viem.ContractFunctionRevertedError) {
      if (_optionalChain([revertError, 'access', _178 => _178.data, 'optionalAccess', _179 => _179.errorName])) {
        return revertError.data.errorName;
      }
      return revertError.reason || "Unknown reason";
    }
    if (err.shortMessage) return err.shortMessage;
  }
  if (err instanceof Error) return err.message;
  return "Unknown reason";
}
var stakingActions = (client, publicClient) => {
  const executeWrite = async (options) => {
    if (!client.account) {
      throw new Error("Account is required for write operations. Initialize client with a wallet account.");
    }
    const account = client.account;
    try {
      await publicClient.call({
        account,
        to: options.to,
        data: options.data,
        value: options.value
      });
    } catch (err) {
      const revertReason = extractRevertReason(err);
      throw new Error(`Transaction would revert: ${revertReason}`);
    }
    let gasLimit = options.gas;
    if (!gasLimit) {
      try {
        const estimated = await publicClient.estimateGas({
          account,
          to: options.to,
          data: options.data,
          value: options.value
        });
        gasLimit = estimated * GAS_BUFFER_MULTIPLIER;
      } catch (e8) {
        gasLimit = FALLBACK_GAS;
      }
    }
    let hash;
    if (account.type === "local") {
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      const txRequest = await publicClient.prepareTransactionRequest({
        account,
        to: options.to,
        data: options.data,
        value: options.value,
        type: "legacy",
        nonce,
        gas: gasLimit,
        chain: client.chain
      });
      const signTransaction = account.signTransaction;
      if (!signTransaction) {
        throw new Error("Account does not support signing transactions");
      }
      const serializedTx = await signTransaction(txRequest);
      hash = await publicClient.sendRawTransaction({ serializedTransaction: serializedTx });
    } else {
      let gasPrice;
      try {
        gasPrice = await client.request({ method: "eth_gasPrice" });
      } catch (e9) {
      }
      hash = await client.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account.address,
            to: options.to,
            data: options.data,
            value: options.value ? `0x${options.value.toString(16)}` : void 0,
            gas: `0x${gasLimit.toString(16)}`,
            type: "0x0",
            ...gasPrice ? { gasPrice } : {}
          }
        ]
      });
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      let revertReason = "Unknown reason";
      try {
        await publicClient.call({
          account,
          to: options.to,
          data: options.data,
          value: options.value,
          blockNumber: receipt.blockNumber
        });
        const gasUsed = receipt.gasUsed;
        if (gasUsed >= gasLimit - 1000n) {
          revertReason = `Out of gas (used ${gasUsed}, limit ${gasLimit})`;
        } else {
          revertReason = `Unknown (simulation passes but tx reverts). Gas: ${gasUsed}/${gasLimit}`;
        }
      } catch (err) {
        revertReason = extractRevertReason(err);
      }
      throw new Error(`Transaction reverted: ${revertReason} (tx: ${hash})`);
    }
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed
    };
  };
  const getStakingAddress = () => {
    const stakingConfig = client.chain.stakingContract;
    if (!_optionalChain([stakingConfig, 'optionalAccess', _180 => _180.address]) || stakingConfig.address === "0x0000000000000000000000000000000000000000") {
      throw new Error("Staking is not supported on studio-based networks. Use testnet-asimov for staking operations.");
    }
    return stakingConfig.address;
  };
  const getStakingContract = () => {
    const address = getStakingAddress();
    return _viem.getContract.call(void 0, {
      address,
      abi: _chunkNUO3HSVBcjs.STAKING_ABI,
      client: { public: publicClient, wallet: client }
    });
  };
  const getReadOnlyStakingContract = () => {
    const address = getStakingAddress();
    return _viem.getContract.call(void 0, {
      address,
      abi: _chunkNUO3HSVBcjs.STAKING_ABI,
      client: publicClient
    });
  };
  const getValidatorRegistrationContext = async () => {
    if (!client.account) {
      throw new Error("Account is required to resolve validator registration context.");
    }
    const consensusMain = client.chain.consensusMainContract;
    if (!_optionalChain([consensusMain, 'optionalAccess', _181 => _181.address]) || consensusMain.address === _viem.zeroAddress) {
      throw new Error("Cannot resolve ValidatorWalletFactory without a consensus main contract.");
    }
    const [addressManager, chainId] = await Promise.all([
      publicClient.readContract({
        address: consensusMain.address,
        abi: CONSENSUS_ADDRESS_MANAGER_ABI,
        functionName: "getAddressManager"
      }),
      publicClient.getChainId()
    ]);
    const registrar = await publicClient.readContract({
      address: addressManager,
      abi: ADDRESS_MANAGER_ABI2,
      functionName: "getAddress",
      args: [VALIDATOR_WALLET_FACTORY_KEY]
    });
    if (!registrar || registrar === _viem.zeroAddress) {
      throw new Error(
        `ValidatorWalletFactory is not registered in AddressManager under key ${VALIDATOR_WALLET_FACTORY_KEY}.`
      );
    }
    return {
      registrar,
      owner: client.account.address,
      chainId: BigInt(chainId)
    };
  };
  const getOperatorTransferContext = async (validator) => {
    const [owner, chainId] = await Promise.all([
      publicClient.readContract({
        address: validator,
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "owner"
      }),
      publicClient.getChainId()
    ]);
    return {
      registrar: validator,
      owner,
      chainId: BigInt(chainId)
    };
  };
  return {
    /** Joins as a validator with the specified stake amount. */
    validatorJoin: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const stakingAddress = getStakingAddress();
      const context = await getValidatorRegistrationContext();
      if (!await verifyOperatorRegistration(options.registration, context)) {
        throw new Error("Operator registration proof does not match the owner, registrar, chain, or public key.");
      }
      const operator = operatorAddressFromPublicKey(options.registration.operatorPubKey);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "validatorJoin",
        args: [options.registration.operatorPubKey, options.registration.possessionProof]
      });
      const result = await executeWrite({ to: stakingAddress, data, value: amount });
      const receipt = await publicClient.getTransactionReceipt({ hash: result.transactionHash });
      let validatorWallet;
      let eventFound = false;
      for (const log of receipt.logs) {
        try {
          const decoded = _viem.decodeEventLog.call(void 0, { abi: _chunkNUO3HSVBcjs.STAKING_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === "ValidatorJoin") {
            validatorWallet = decoded.args.validator;
            eventFound = true;
            break;
          }
        } catch (e10) {
        }
      }
      if (!eventFound) {
        throw new Error(
          `ValidatorJoin event not found in transaction ${result.transactionHash}. Transaction succeeded but validator wallet address could not be determined.`
        );
      }
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        validatorWallet,
        operator,
        amount: formatStakingAmount(amount),
        amountRaw: amount
      };
    },
    /** Resolves the registrar, owner, and chain binding required to create an operator proof. */
    getValidatorRegistrationContext,
    /**
     * Adds additional self-stake to an active validator position. The
     * underlying Staking contract requires msg.sender == ValidatorWallet,
     * so the call is routed through the wallet's own validatorDeposit
     * forwarder (which re-enters Staking with the correct sender).
     */
    validatorDeposit: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "validatorDeposit"
      });
      return executeWrite({ to: options.validator, data, value: amount });
    },
    /**
     * Exits a validator position by burning the specified shares. Same
     * msg.sender constraint as validatorDeposit — routed via the wallet.
     */
    validatorExit: async (options) => {
      const shares = typeof options.shares === "string" ? BigInt(options.shares) : options.shares;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "validatorExit",
        args: [shares]
      });
      return executeWrite({ to: options.validator, data });
    },
    /** Claims pending validator withdrawals. */
    validatorClaim: async (options) => {
      if (!_optionalChain([options, 'optionalAccess', _182 => _182.validator]) && !client.account) {
        throw new Error("Either provide validator address or initialize client with an account");
      }
      const validatorAddress = _optionalChain([options, 'optionalAccess', _183 => _183.validator]) || client.account.address;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "validatorClaim",
        args: [validatorAddress]
      });
      const result = await executeWrite({ to: getStakingAddress(), data });
      return { ...result, claimedAmount: 0n };
    },
    /** Primes a validator for participation in the next epoch. */
    validatorPrime: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "validatorPrime",
        args: [options.validator]
      });
      return executeWrite({ to: getStakingAddress(), data });
    },
    /** @deprecated Use initiateOperatorTransfer followed by completeOperatorTransfer. */
    setOperator: async (options) => {
      throw new Error(
        `setOperator cannot rotate ${options.validator} to ${options.operator} on the train: create an operator possession proof, then call initiateOperatorTransfer and completeOperatorTransfer.`
      );
    },
    getOperatorTransferContext,
    /**
     * Starts the two-step operator rotation. The proof is checked against the
     * wallet-bound context before submission so a registration built for the
     * wrong registrar fails locally instead of as an opaque on-chain revert.
     */
    initiateOperatorTransfer: async (options) => {
      const context = await getOperatorTransferContext(options.validator);
      if (!await verifyOperatorRegistration(options.registration, context)) {
        throw new Error(
          "Operator registration proof does not match the wallet, owner, chain, or public key. Rotation proofs must use the validator wallet as their registrar."
        );
      }
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "initiateOperatorTransfer",
        args: [options.registration.operatorPubKey, options.registration.possessionProof]
      });
      return executeWrite({ to: options.validator, data });
    },
    /**
     * Completes a pending rotation. Callable by the wallet owner or the pending
     * operator, and only once the factory's operatorTransferDelay has elapsed.
     */
    completeOperatorTransfer: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "completeOperatorTransfer",
        args: []
      });
      return executeWrite({ to: options.validator, data });
    },
    /** Abandons a pending rotation, leaving the current operator in place. */
    cancelOperatorTransfer: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "cancelOperatorTransfer",
        args: []
      });
      return executeWrite({ to: options.validator, data });
    },
    /** Reads the pending operator and when its transfer was initiated. */
    getPendingOperator: async (validator) => {
      const [operator, initiatedAt] = await publicClient.readContract({
        address: validator,
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "getPendingOperator"
      });
      return { operator, initiatedAt };
    },
    /** Sets validator identity information (name, website, social links). */
    setIdentity: async (options) => {
      let extraCidBytes = "0x";
      if (options.extraCid) {
        if (options.extraCid.startsWith("0x")) {
          extraCidBytes = options.extraCid;
        } else {
          extraCidBytes = _viem.toHex.call(void 0, new TextEncoder().encode(options.extraCid));
        }
      }
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        functionName: "setIdentity",
        args: [
          options.moniker,
          options.logoUri || "",
          options.website || "",
          options.description || "",
          options.email || "",
          options.twitter || "",
          options.telegram || "",
          options.github || "",
          extraCidBytes
        ]
      });
      return executeWrite({ to: options.validator, data });
    },
    /** Delegates stake to a validator. */
    delegatorJoin: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "delegatorJoin",
        args: [options.validator]
      });
      const result = await executeWrite({ to: getStakingAddress(), data, value: amount });
      return {
        ...result,
        validator: options.validator,
        delegator: client.account.address,
        amount: formatStakingAmount(amount),
        amountRaw: amount
      };
    },
    /** Exits a delegation by burning the specified shares. */
    delegatorExit: async (options) => {
      const shares = typeof options.shares === "string" ? BigInt(options.shares) : options.shares;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "delegatorExit",
        args: [options.validator, shares]
      });
      return executeWrite({ to: getStakingAddress(), data });
    },
    /** Claims pending delegator withdrawals. */
    delegatorClaim: async (options) => {
      if (!options.delegator && !client.account) {
        throw new Error("Either provide delegator address or initialize client with an account");
      }
      const delegatorAddress = options.delegator || client.account.address;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: _chunkNUO3HSVBcjs.STAKING_ABI,
        functionName: "delegatorClaim",
        args: [delegatorAddress, options.validator]
      });
      return executeWrite({ to: getStakingAddress(), data });
    },
    /** Checks whether an address is a registered/joined validator wallet. */
    isValidator: async (address) => {
      const contract = getReadOnlyStakingContract();
      return contract.read.isValidator([address]);
    },
    /** Returns comprehensive information about a validator including stake, identity, and status. */
    getValidatorInfo: async (validator) => {
      const contract = getReadOnlyStakingContract();
      const isVal = await contract.read.isValidator([validator]);
      if (!isVal) {
        throw new Error(`Address ${validator} is not a validator`);
      }
      const walletContract = _viem.getContract.call(void 0, {
        address: validator,
        abi: _chunkNUO3HSVBcjs.VALIDATOR_WALLET_ABI,
        client: publicClient
      });
      const [view, owner, operator, identityRaw, currentEpoch, validatorMinStake, banned] = await Promise.all([
        contract.read.validatorView([validator]),
        walletContract.read.owner(),
        walletContract.read.operator(),
        walletContract.read.getIdentity().catch(() => null),
        contract.read.epoch(),
        contract.read.validatorMinStake(),
        contract.read.isValidatorBanned([validator])
      ]);
      let identity;
      if (identityRaw && identityRaw.moniker) {
        identity = {
          moniker: identityRaw.moniker,
          logoUri: identityRaw.logoUri,
          website: identityRaw.website,
          description: identityRaw.description,
          email: identityRaw.email,
          twitter: identityRaw.twitter,
          telegram: identityRaw.telegram,
          github: identityRaw.github,
          extraCid: identityRaw.extraCid ? _viem.toHex.call(void 0, identityRaw.extraCid) : ""
        };
      }
      const needsPriming = currentEpoch > 0n && view.ePrimed < currentEpoch - 1n;
      const depositLen = await contract.read.validatorDepositLen([validator]);
      const pendingDeposits = [];
      for (let i = 0n; i < depositLen; i++) {
        const [epoch, commit] = await contract.read.validatorDeposit([validator, i]);
        pendingDeposits.push({
          epoch,
          stake: formatStakingAmount(commit.input),
          stakeRaw: commit.input,
          shares: commit.output
        });
      }
      const withdrawalLen = await contract.read.validatorWithdrawalLen([validator]);
      const pendingWithdrawals = [];
      for (let i = 0n; i < withdrawalLen; i++) {
        const [epoch, commit] = await contract.read.validatorWithdrawal([validator, i]);
        pendingWithdrawals.push({
          epoch,
          shares: commit.input,
          stake: formatStakingAmount(commit.output),
          stakeRaw: commit.output
        });
      }
      return {
        address: validator,
        owner,
        operator,
        vStake: formatStakingAmount(view.vStake),
        vStakeRaw: view.vStake,
        vShares: view.vShares,
        dStake: formatStakingAmount(view.dStake),
        dStakeRaw: view.dStake,
        dShares: view.dShares,
        vDeposit: formatStakingAmount(view.vDeposit),
        vDepositRaw: view.vDeposit,
        vWithdrawal: formatStakingAmount(view.vWithdrawal),
        vWithdrawalRaw: view.vWithdrawal,
        ePrimed: view.ePrimed,
        live: view.live,
        banned,
        bannedEpoch: banned ? view.eBanned : void 0,
        needsPriming,
        currentEpoch,
        validatorMinStake: formatStakingAmount(validatorMinStake),
        validatorMinStakeRaw: validatorMinStake,
        belowMin: view.vStake < validatorMinStake,
        identity,
        pendingDeposits,
        pendingWithdrawals
      };
    },
    /** Returns the current epoch number. */
    getCurrentEpoch: async () => {
      const contract = getReadOnlyStakingContract();
      return await contract.read.epoch();
    },
    /** Checks whether a validator's self-stake is below the configured validator minimum. */
    isValidatorBelowMin: async (validator) => {
      const contract = getReadOnlyStakingContract();
      const [view, minStake] = await Promise.all([
        contract.read.validatorView([validator]),
        contract.read.validatorMinStake()
      ]);
      return view.vStake < minStake;
    },
    /** Returns delegation stake information for a delegator-validator pair. */
    getStakeInfo: async (delegator, validator) => {
      const contract = getReadOnlyStakingContract();
      const shares = await contract.read.sharesOf([delegator, validator]);
      let stake = 0n;
      if (shares > 0n) {
        stake = await contract.read.stakeOf([delegator, validator]);
      }
      const depositLen = await contract.read.delegatorDepositLen([
        delegator,
        validator
      ]);
      const pendingDeposits = [];
      for (let i = 0n; i < depositLen; i++) {
        const [claim, commit] = await contract.read.delegatorDeposit([
          delegator,
          validator,
          i
        ]);
        pendingDeposits.push({
          epoch: commit.epoch,
          stake: formatStakingAmount(commit.input),
          stakeRaw: commit.input,
          shares: claim.quantity
        });
      }
      const withdrawalLen = await contract.read.delegatorWithdrawalLen([
        delegator,
        validator
      ]);
      const pendingWithdrawals = [];
      for (let i = 0n; i < withdrawalLen; i++) {
        const [claim, commit] = await contract.read.delegatorWithdrawal([
          delegator,
          validator,
          i
        ]);
        pendingWithdrawals.push({
          epoch: commit.epoch,
          shares: claim.quantity,
          stake: formatStakingAmount(commit.output),
          stakeRaw: commit.output
        });
      }
      return {
        delegator,
        validator,
        shares,
        stake: formatStakingAmount(stake),
        stakeRaw: stake,
        pendingDeposits,
        pendingWithdrawals
      };
    },
    /** Returns current epoch information including timing, stake requirements, and inflation data. */
    getEpochInfo: async () => {
      const contract = getReadOnlyStakingContract();
      const [
        epoch,
        finalized,
        activeCount,
        epochMinDuration,
        epochZeroMinDuration,
        epochOdd,
        epochEven,
        valMinStake,
        delMinStake
      ] = await Promise.all([
        contract.read.epoch(),
        contract.read.finalized(),
        contract.read.selectableValidatorsCount(),
        contract.read.epochMinDuration(),
        contract.read.epochZeroMinDuration(),
        contract.read.epochOdd(),
        contract.read.epochEven(),
        contract.read.validatorMinStake(),
        contract.read.delegatorMinStake()
      ]);
      const raw = epoch % 2n === 0n ? epochEven : epochOdd;
      const currentEpochData = {
        start: raw[0],
        end: raw[1],
        inflation: raw[2],
        weight: raw[3],
        weightDeposit: raw[4],
        weightWithdrawal: raw[5],
        vcount: raw[6],
        claimed: raw[7],
        stakeDeposit: raw[8],
        stakeWithdrawal: raw[9],
        slashed: raw[10]
      };
      const currentEpochEnd = currentEpochData.end > 0n;
      let nextEpochEstimate = null;
      if (!currentEpochEnd) {
        const duration = epoch === 0n ? epochZeroMinDuration : epochMinDuration;
        const estimatedEndMs = Number(currentEpochData.start + duration) * 1e3;
        nextEpochEstimate = new Date(estimatedEndMs);
      }
      return {
        currentEpoch: epoch,
        lastFinalizedEpoch: finalized,
        activeValidatorsCount: activeCount,
        totalWeight: currentEpochData.weight,
        inflationRaw: currentEpochData.inflation,
        epochMinDuration,
        nextEpochEstimate,
        validatorMinStake: formatStakingAmount(valMinStake),
        validatorMinStakeRaw: valMinStake,
        delegatorMinStake: formatStakingAmount(delMinStake),
        delegatorMinStakeRaw: delMinStake
      };
    },
    /** Returns detailed data for a specific epoch. */
    getEpochData: async (epochNumber) => {
      const contract = getReadOnlyStakingContract();
      const [currentEpoch, epochOdd, epochEven] = await Promise.all([
        contract.read.epoch(),
        contract.read.epochOdd(),
        contract.read.epochEven()
      ]);
      if (epochNumber > currentEpoch) {
        throw new Error(`Epoch ${epochNumber} has not started yet (current: ${currentEpoch})`);
      }
      if (epochNumber < currentEpoch - 1n && currentEpoch > 0n) {
        throw new Error(`Epoch ${epochNumber} data no longer available (only current and previous epoch stored)`);
      }
      const raw = epochNumber % 2n === 0n ? epochEven : epochOdd;
      return {
        start: raw[0],
        end: raw[1],
        inflation: raw[2],
        weight: raw[3],
        weightDeposit: raw[4],
        weightWithdrawal: raw[5],
        vcount: raw[6],
        claimed: raw[7],
        stakeDeposit: raw[8],
        stakeWithdrawal: raw[9],
        slashed: raw[10]
      };
    },
    /** Returns validators currently eligible for consensus duties. */
    getActiveValidators: async () => {
      const contract = getReadOnlyStakingContract();
      return contract.read.selectableValidators();
    },
    /** Returns the count of validators currently eligible for consensus duties. */
    getActiveValidatorsCount: async () => {
      const contract = getReadOnlyStakingContract();
      return contract.read.selectableValidatorsCount();
    },
    /** Returns every validator identity in the append-only joined registry. */
    getJoinedValidators: async () => {
      const contract = getReadOnlyStakingContract();
      const total = await contract.read.validatorsJoinedCount();
      const validators = [];
      for (let start = 0n; start < total; start += VALIDATORS_JOINED_PAGE_SIZE) {
        const page = await contract.read.getValidatorsJoined([start, VALIDATORS_JOINED_PAGE_SIZE]);
        if (page.length === 0) break;
        validators.push(...page);
      }
      return validators.filter((v) => v !== "0x0000000000000000000000000000000000000000");
    },
    /** Returns the size of the append-only joined validator registry. */
    getJoinedValidatorsCount: async () => {
      const contract = getReadOnlyStakingContract();
      return contract.read.validatorsJoinedCount();
    },
    /** Returns addresses of validators currently in quarantine. */
    getQuarantinedValidators: async () => {
      const contract = getReadOnlyStakingContract();
      return contract.read.getValidatorQuarantineList();
    },
    /** Returns banned validators with ban duration and permanent ban status. */
    getBannedValidators: async (startIndex = 0n, size = 100n) => {
      const contract = getReadOnlyStakingContract();
      const result = await contract.read.getAllBannedValidators([startIndex, size]);
      return result.map((v) => ({
        validator: v.validator,
        untilEpoch: v.untilEpochBanned,
        permanentlyBanned: v.permanentlyBanned
      }));
    },
    /** Returns detailed quarantine information with pagination. */
    getQuarantinedValidatorsDetailed: async (startIndex = 0n, size = 100n) => {
      const contract = getReadOnlyStakingContract();
      const result = await contract.read.getAllQuarantinedValidators([startIndex, size]);
      return result.map((v) => ({
        validator: v.validator,
        untilEpoch: v.untilEpochBanned,
        permanentlyBanned: v.permanentlyBanned
      }));
    },
    getStakingContract,
    parseStakingAmount,
    formatStakingAmount
  };
};

// src/vesting/actions.ts










var FALLBACK_GAS2 = 1000000n;
var GAS_BUFFER_MULTIPLIER2 = 2n;
var VESTING_FACTORY_KEY = "VestingFactory";
var VALIDATOR_WALLET_FACTORY_KEY2 = "ValidatorWalletFactory";
var COMBINED_ERROR_ABI2 = [...VESTING_ABI, ...VESTING_FACTORY_ABI, ...ADDRESS_MANAGER_ABI2, ..._chunkNUO3HSVBcjs.STAKING_ABI];
function extractRevertReason2(err) {
  if (err instanceof _viem.BaseError) {
    const rawError = err.walk((e) => e instanceof _viem.RawContractError);
    if (rawError instanceof _viem.RawContractError && rawError.data && typeof rawError.data === "string") {
      try {
        const decoded = _viem.decodeErrorResult.call(void 0, { abi: COMBINED_ERROR_ABI2, data: rawError.data });
        return decoded.errorName;
      } catch (e11) {
      }
    }
    let current = err;
    while (current) {
      if (current && typeof current === "object") {
        const obj = current;
        if (obj.data && typeof obj.data === "string" && obj.data.startsWith("0x")) {
          try {
            const decoded = _viem.decodeErrorResult.call(void 0, { abi: COMBINED_ERROR_ABI2, data: obj.data });
            return decoded.errorName;
          } catch (e12) {
          }
        }
        current = obj.cause;
      } else {
        break;
      }
    }
    const revertError = err.walk((e) => e instanceof _viem.ContractFunctionRevertedError);
    if (revertError instanceof _viem.ContractFunctionRevertedError) {
      if (_optionalChain([revertError, 'access', _184 => _184.data, 'optionalAccess', _185 => _185.errorName])) {
        return revertError.data.errorName;
      }
      return revertError.reason || "Unknown reason";
    }
    if (err.shortMessage) return err.shortMessage;
  }
  if (err instanceof Error) return err.message;
  return "Unknown reason";
}
function encodeExtraCid(extraCid) {
  if (!extraCid) return "0x";
  if (extraCid.startsWith("0x")) return extraCid;
  return _viem.toHex.call(void 0, new TextEncoder().encode(extraCid));
}
var vestingActions = (client, publicClient) => {
  const executeWrite = async (options) => {
    if (!client.account) {
      throw new Error("Account is required for write operations. Initialize client with a wallet account.");
    }
    const account = client.account;
    try {
      await publicClient.call({
        account,
        to: options.to,
        data: options.data,
        value: options.value
      });
    } catch (err) {
      const revertReason = extractRevertReason2(err);
      throw new Error(`Transaction would revert: ${revertReason}`);
    }
    let gasLimit = options.gas;
    if (!gasLimit) {
      try {
        const estimated = await publicClient.estimateGas({
          account,
          to: options.to,
          data: options.data,
          value: options.value
        });
        gasLimit = estimated * GAS_BUFFER_MULTIPLIER2;
      } catch (e13) {
        gasLimit = FALLBACK_GAS2;
      }
    }
    let hash;
    if (account.type === "local") {
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      const txRequest = await publicClient.prepareTransactionRequest({
        account,
        to: options.to,
        data: options.data,
        value: options.value,
        type: "legacy",
        nonce,
        gas: gasLimit,
        chain: client.chain
      });
      const signTransaction = account.signTransaction;
      if (!signTransaction) {
        throw new Error("Account does not support signing transactions");
      }
      const serializedTx = await signTransaction(txRequest);
      hash = await publicClient.sendRawTransaction({ serializedTransaction: serializedTx });
    } else {
      let gasPrice;
      try {
        gasPrice = await client.request({ method: "eth_gasPrice" });
      } catch (e14) {
      }
      hash = await client.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account.address,
            to: options.to,
            data: options.data,
            value: options.value ? `0x${options.value.toString(16)}` : void 0,
            gas: `0x${gasLimit.toString(16)}`,
            type: "0x0",
            ...gasPrice ? { gasPrice } : {}
          }
        ]
      });
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      let revertReason = "Unknown reason";
      try {
        await publicClient.call({
          account,
          to: options.to,
          data: options.data,
          value: options.value,
          blockNumber: receipt.blockNumber
        });
        const gasUsed = receipt.gasUsed;
        if (gasUsed >= gasLimit - 1000n) {
          revertReason = `Out of gas (used ${gasUsed}, limit ${gasLimit})`;
        } else {
          revertReason = `Unknown (simulation passes but tx reverts). Gas: ${gasUsed}/${gasLimit}`;
        }
      } catch (err) {
        revertReason = extractRevertReason2(err);
      }
      throw new Error(`Transaction reverted: ${revertReason} (tx: ${hash})`);
    }
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed
    };
  };
  const readVesting = async (vesting, functionName, args = []) => {
    return publicClient.readContract({
      address: vesting,
      abi: VESTING_ABI,
      functionName,
      args
    });
  };
  const readFactory = async (factory, functionName, args = []) => {
    return publicClient.readContract({
      address: factory,
      abi: VESTING_FACTORY_ABI,
      functionName,
      args
    });
  };
  const getAddressManagerAddress = async (addressManager) => {
    if (addressManager) return addressManager;
    const consensusMain = client.chain.consensusMainContract;
    if (!_optionalChain([consensusMain, 'optionalAccess', _186 => _186.address]) || consensusMain.address === _viem.zeroAddress) {
      throw new Error("Cannot discover VestingFactory without a consensus main contract or explicit addressManager.");
    }
    return publicClient.readContract({
      address: consensusMain.address,
      abi: CONSENSUS_ADDRESS_MANAGER_ABI,
      functionName: "getAddressManager"
    });
  };
  const resolveVestingFactoryAddress = async (options) => {
    if (_optionalChain([options, 'optionalAccess', _187 => _187.factory])) return options.factory;
    const addressManager = await getAddressManagerAddress(_optionalChain([options, 'optionalAccess', _188 => _188.addressManager]));
    const factory = await publicClient.readContract({
      address: addressManager,
      abi: ADDRESS_MANAGER_ABI2,
      functionName: "getAddress",
      args: [VESTING_FACTORY_KEY]
    });
    if (!factory || factory === _viem.zeroAddress) {
      throw new Error(`VestingFactory is not registered in AddressManager under key ${VESTING_FACTORY_KEY}.`);
    }
    return factory;
  };
  const getVestingValidatorRegistrationContext = async (vesting) => {
    const [addressManager, chainId] = await Promise.all([
      readVesting(vesting, "addressManager"),
      publicClient.getChainId()
    ]);
    const registrar = await publicClient.readContract({
      address: addressManager,
      abi: ADDRESS_MANAGER_ABI2,
      functionName: "getAddress",
      args: [VALIDATOR_WALLET_FACTORY_KEY2]
    });
    if (!registrar || registrar === _viem.zeroAddress) {
      throw new Error(
        `ValidatorWalletFactory is not registered in AddressManager under key ${VALIDATOR_WALLET_FACTORY_KEY2}.`
      );
    }
    return {
      registrar,
      owner: vesting,
      chainId: BigInt(chainId)
    };
  };
  const getVestingContract = (vesting) => {
    return _viem.getContract.call(void 0, {
      address: vesting,
      abi: VESTING_ABI,
      client: { public: publicClient, wallet: client }
    });
  };
  const getVestingFactoryContract = (factory) => {
    return _viem.getContract.call(void 0, {
      address: factory,
      abi: VESTING_FACTORY_ABI,
      client: publicClient
    });
  };
  return {
    /** Delegates vesting-held tokens to a validator. Must be called by the vesting beneficiary. */
    vestingDelegatorJoin: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingDelegatorJoin",
        args: [options.validator, amount]
      });
      const result = await executeWrite({ to: options.vesting, data });
      return {
        ...result,
        vesting: options.vesting,
        validator: options.validator,
        beneficiary: client.account.address,
        amount: formatStakingAmount(amount),
        amountRaw: amount
      };
    },
    /** Exits a vesting contract's delegation by burning shares. Must be called by the vesting beneficiary. */
    vestingDelegatorExit: async (options) => {
      const shares = typeof options.shares === "string" ? BigInt(options.shares) : options.shares;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingDelegatorExit",
        args: [options.validator, shares]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Claims exited delegation funds back into the vesting contract. Must be called by the vesting beneficiary. */
    vestingDelegatorClaim: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingDelegatorClaim",
        args: [options.validator]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Creates a validator wallet and self-stakes vesting-held tokens. Must be called by the vesting beneficiary. */
    vestingValidatorJoin: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const context = await getVestingValidatorRegistrationContext(options.vesting);
      if (!await verifyOperatorRegistration(options.registration, context)) {
        throw new Error("Operator registration proof does not match the vesting, registrar, chain, or public key.");
      }
      const operator = operatorAddressFromPublicKey(options.registration.operatorPubKey);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorJoin",
        args: [options.registration.operatorPubKey, options.registration.possessionProof, amount]
      });
      const result = await executeWrite({ to: options.vesting, data });
      return {
        ...result,
        vesting: options.vesting,
        operator,
        beneficiary: client.account.address,
        amount: formatStakingAmount(amount),
        amountRaw: amount
      };
    },
    /** Adds more vesting-held self-stake to one of the vesting's validator wallets. */
    vestingValidatorDeposit: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorDeposit",
        args: [options.wallet, amount]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Exits validator self-stake by burning shares from a vesting-owned validator wallet. */
    vestingValidatorExit: async (options) => {
      const shares = typeof options.shares === "string" ? BigInt(options.shares) : options.shares;
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorExit",
        args: [options.wallet, shares]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Claims exited validator self-stake back into the vesting contract. */
    vestingValidatorClaim: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorClaim",
        args: [options.wallet]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Begins a two-step operator transfer for a vesting-owned validator wallet. */
    vestingValidatorInitiateOperatorTransfer: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorInitiateOperatorTransfer",
        args: [options.wallet, options.newOperator]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Completes a pending operator transfer for a vesting-owned validator wallet. */
    vestingValidatorCompleteOperatorTransfer: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorCompleteOperatorTransfer",
        args: [options.wallet]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Cancels a pending operator transfer for a vesting-owned validator wallet. */
    vestingValidatorCancelOperatorTransfer: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorCancelOperatorTransfer",
        args: [options.wallet]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Sets validator identity metadata on a vesting-owned validator wallet. */
    vestingValidatorSetIdentity: async (options) => {
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingValidatorSetIdentity",
        args: [
          options.wallet,
          options.moniker,
          options.logoUri || "",
          options.website || "",
          options.description || "",
          options.email || "",
          options.twitter || "",
          options.telegram || "",
          options.github || "",
          encodeExtraCid(options.extraCid)
        ]
      });
      return executeWrite({ to: options.vesting, data });
    },
    /** Withdraws vested tokens to the beneficiary. Must be called by the vesting beneficiary. */
    vestingWithdraw: async (options) => {
      const amount = parseStakingAmount(options.amount);
      const data = _viem.encodeFunctionData.call(void 0, {
        abi: VESTING_ABI,
        functionName: "vestingWithdraw",
        args: [amount]
      });
      const result = await executeWrite({ to: options.vesting, data });
      return {
        ...result,
        vesting: options.vesting,
        beneficiary: client.account.address,
        amount: formatStakingAmount(amount),
        amountRaw: amount
      };
    },
    /** Resolves VestingFactory from AddressManager key "VestingFactory". */
    getVestingFactoryAddress: async (options) => {
      return resolveVestingFactoryAddress(options);
    },
    /** Returns the Vesting contract for a beneficiary, or null when none is registered. */
    getVestingForBeneficiary: async (beneficiary, options) => {
      const factory = await resolveVestingFactoryAddress(options);
      const vesting = await readFactory(factory, "getVesting", [beneficiary]);
      return vesting === _viem.zeroAddress ? null : vesting;
    },
    /** Returns the beneficiary's vesting contracts. v0.6-dev permits one vesting per beneficiary. */
    getBeneficiaryVestings: async (beneficiary, options) => {
      const vesting = await resolveVestingFactoryAddress(options).then((factory) => readFactory(factory, "getVesting", [beneficiary]));
      return vesting === _viem.zeroAddress ? [] : [vesting];
    },
    /** Checks whether an address is registered as a Vesting contract by the factory. */
    isVestingAddress: async (address, options) => {
      const factory = await resolveVestingFactoryAddress(options);
      return readFactory(factory, "isVestingAddress", [address]);
    },
    getVestingContract,
    getVestingFactoryContract,
    vestedAmount: (vesting) => readVesting(vesting, "vestedAmount"),
    unvestedAmount: (vesting) => readVesting(vesting, "unvestedAmount"),
    withdrawableAmount: (vesting) => readVesting(vesting, "withdrawableAmount"),
    getVestingSchedule: async (vesting) => {
      const [startDate, cliffDuration, periodDuration, numberOfPeriods, cliffUnlockBps, needsManualUnlock] = await Promise.all([
        readVesting(vesting, "startDate"),
        readVesting(vesting, "cliffDuration"),
        readVesting(vesting, "periodDuration"),
        readVesting(vesting, "numberOfPeriods"),
        readVesting(vesting, "cliffUnlockBps"),
        readVesting(vesting, "needsManualUnlock")
      ]);
      return { startDate, cliffDuration, periodDuration, numberOfPeriods, cliffUnlockBps, needsManualUnlock };
    },
    getVestingState: async (vesting) => {
      const [
        name,
        category,
        beneficiary,
        creator,
        revoker,
        factory,
        addressManager,
        totalAmount,
        startDate,
        cliffDuration,
        periodDuration,
        numberOfPeriods,
        cliffUnlockBps,
        needsManualUnlock,
        manualUnlocked,
        revoked,
        vestingStopped,
        totalWithdrawn,
        vestedAtRevocation,
        totalAmountAtRevocation,
        revokedAt,
        vestingStoppedAt,
        vestedAtStop,
        postRevocationBeneficiaryRewards,
        postRevocationBeneficiaryLosses,
        accumulatedRewards,
        accumulatedLosses,
        vested,
        unvested,
        withdrawable
      ] = await Promise.all([
        readVesting(vesting, "name"),
        readVesting(vesting, "category"),
        readVesting(vesting, "beneficiary"),
        readVesting(vesting, "creator"),
        readVesting(vesting, "revoker"),
        readVesting(vesting, "factory"),
        readVesting(vesting, "addressManager"),
        readVesting(vesting, "totalAmount"),
        readVesting(vesting, "startDate"),
        readVesting(vesting, "cliffDuration"),
        readVesting(vesting, "periodDuration"),
        readVesting(vesting, "numberOfPeriods"),
        readVesting(vesting, "cliffUnlockBps"),
        readVesting(vesting, "needsManualUnlock"),
        readVesting(vesting, "manualUnlocked"),
        readVesting(vesting, "revoked"),
        readVesting(vesting, "vestingStopped"),
        readVesting(vesting, "totalWithdrawn"),
        readVesting(vesting, "vestedAtRevocation"),
        readVesting(vesting, "totalAmountAtRevocation"),
        readVesting(vesting, "revokedAt"),
        readVesting(vesting, "vestingStoppedAt"),
        readVesting(vesting, "vestedAtStop"),
        readVesting(vesting, "postRevocationBeneficiaryRewards"),
        readVesting(vesting, "postRevocationBeneficiaryLosses"),
        readVesting(vesting, "accumulatedRewards"),
        readVesting(vesting, "accumulatedLosses"),
        readVesting(vesting, "vestedAmount"),
        readVesting(vesting, "unvestedAmount"),
        readVesting(vesting, "withdrawableAmount")
      ]);
      return {
        name,
        category,
        beneficiary,
        creator,
        revoker,
        factory,
        addressManager,
        totalAmount: formatStakingAmount(totalAmount),
        totalAmountRaw: totalAmount,
        startDate,
        cliffDuration,
        periodDuration,
        numberOfPeriods,
        cliffUnlockBps,
        needsManualUnlock,
        manualUnlocked,
        revoked,
        vestingStopped,
        totalWithdrawn: formatStakingAmount(totalWithdrawn),
        totalWithdrawnRaw: totalWithdrawn,
        vestedAtRevocation: formatStakingAmount(vestedAtRevocation),
        vestedAtRevocationRaw: vestedAtRevocation,
        totalAmountAtRevocation: formatStakingAmount(totalAmountAtRevocation),
        totalAmountAtRevocationRaw: totalAmountAtRevocation,
        revokedAt,
        vestingStoppedAt,
        vestedAtStop: formatStakingAmount(vestedAtStop),
        vestedAtStopRaw: vestedAtStop,
        postRevocationBeneficiaryRewards: formatStakingAmount(postRevocationBeneficiaryRewards),
        postRevocationBeneficiaryRewardsRaw: postRevocationBeneficiaryRewards,
        postRevocationBeneficiaryLosses: formatStakingAmount(postRevocationBeneficiaryLosses),
        postRevocationBeneficiaryLossesRaw: postRevocationBeneficiaryLosses,
        accumulatedRewards: formatStakingAmount(accumulatedRewards),
        accumulatedRewardsRaw: accumulatedRewards,
        accumulatedLosses: formatStakingAmount(accumulatedLosses),
        accumulatedLossesRaw: accumulatedLosses,
        vestedAmount: formatStakingAmount(vested),
        vestedAmountRaw: vested,
        unvestedAmount: formatStakingAmount(unvested),
        unvestedAmountRaw: unvested,
        withdrawableAmount: formatStakingAmount(withdrawable),
        withdrawableAmountRaw: withdrawable
      };
    },
    vestingName: (vesting) => readVesting(vesting, "name"),
    vestingCategory: (vesting) => readVesting(vesting, "category"),
    vestingBeneficiary: (vesting) => readVesting(vesting, "beneficiary"),
    vestingCreator: (vesting) => readVesting(vesting, "creator"),
    vestingRevoker: (vesting) => readVesting(vesting, "revoker"),
    vestingFactory: (vesting) => readVesting(vesting, "factory"),
    vestingAddressManager: (vesting) => readVesting(vesting, "addressManager"),
    getVestingValidatorRegistrationContext,
    vestingTotalAmount: (vesting) => readVesting(vesting, "totalAmount"),
    vestingStartDate: (vesting) => readVesting(vesting, "startDate"),
    vestingCliffDuration: (vesting) => readVesting(vesting, "cliffDuration"),
    vestingPeriodDuration: (vesting) => readVesting(vesting, "periodDuration"),
    vestingNumberOfPeriods: (vesting) => readVesting(vesting, "numberOfPeriods"),
    vestingCliffUnlockBps: (vesting) => readVesting(vesting, "cliffUnlockBps"),
    vestingNeedsManualUnlock: (vesting) => readVesting(vesting, "needsManualUnlock"),
    vestingManualUnlocked: (vesting) => readVesting(vesting, "manualUnlocked"),
    vestingRevoked: (vesting) => readVesting(vesting, "revoked"),
    vestingStopped: (vesting) => readVesting(vesting, "vestingStopped"),
    vestingTotalWithdrawn: (vesting) => readVesting(vesting, "totalWithdrawn"),
    vestingVestedAtRevocation: (vesting) => readVesting(vesting, "vestedAtRevocation"),
    vestingTotalAmountAtRevocation: (vesting) => readVesting(vesting, "totalAmountAtRevocation"),
    vestingRevokedAt: (vesting) => readVesting(vesting, "revokedAt"),
    vestingStoppedAt: (vesting) => readVesting(vesting, "vestingStoppedAt"),
    vestingVestedAtStop: (vesting) => readVesting(vesting, "vestedAtStop"),
    vestingPostRevocationBeneficiaryRewards: (vesting) => readVesting(vesting, "postRevocationBeneficiaryRewards"),
    vestingPostRevocationBeneficiaryLosses: (vesting) => readVesting(vesting, "postRevocationBeneficiaryLosses"),
    vestingDepositedPerValidator: (vesting, validator) => readVesting(vesting, "depositedPerValidator", [validator]),
    vestingPendingExitDeposited: (vesting, validator) => readVesting(vesting, "pendingExitDeposited", [validator]),
    getValidatorWallets: (vesting) => readVesting(vesting, "getValidatorWallets"),
    validatorWalletCount: (vesting) => readVesting(vesting, "validatorWalletCount"),
    validatorDeposited: (vesting, wallet) => readVesting(vesting, "validatorDeposited", [wallet]),
    isValidatorWallet: (vesting, wallet) => readVesting(vesting, "isValidatorWallet", [wallet]),
    vestingAccumulatedRewards: (vesting) => readVesting(vesting, "accumulatedRewards"),
    vestingAccumulatedLosses: (vesting) => readVesting(vesting, "accumulatedLosses")
  };
};

// src/chains/actions.ts
function chainActions(_client) {
  return {
    /**
     * @deprecated This method is deprecated and will be removed in a future release.
     * The consensus contract is now resolved from the static chain definition.
     */
    initializeConsensusSmartContract: async (_forceReset = false) => {
      console.warn(
        "[genlayer-js] initializeConsensusSmartContract() is deprecated and will be removed in a future release. The consensus contract is now resolved from the static chain definition."
      );
    }
  };
}

// src/client/client.ts
var PROVIDER_METHODS = /* @__PURE__ */ new Set([
  "eth_accounts",
  "eth_requestAccounts",
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_signTypedData_v4"
]);
var assertChainMatch = async (provider, chainConfig) => {
  if (chainConfig.isStudio) return;
  const expectedChainIdHex = `0x${chainConfig.id.toString(16)}`;
  try {
    const currentChainId = await provider.request({ method: "eth_chainId" });
    if (currentChainId !== expectedChainIdHex) {
      const currentId = parseInt(currentChainId, 16);
      throw new Error(
        `Wallet is on chain ${currentId} but client is configured for chain ${chainConfig.id} (${chainConfig.name}). Call client.connect("${chainConfig.name}") or switch your wallet to the correct network before sending transactions.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Wallet is on chain")) throw err;
  }
};
var getCustomTransportConfig = (config, chainConfig) => {
  const isAddress = typeof config.account !== "object";
  return {
    async request({ method, params = [] }) {
      if (PROVIDER_METHODS.has(method) && isAddress) {
        const provider = config.provider || (typeof window !== "undefined" ? window.ethereum : void 0);
        if (provider) {
          try {
            if (method === "eth_sendTransaction" || method === "eth_signTransaction") {
              await assertChainMatch(provider, chainConfig);
            }
            return await provider.request({ method, params });
          } catch (err) {
            console.warn(`Error using provider for method ${method}:`, err);
            throw err;
          }
        }
      }
      try {
        const response = await fetch(chainConfig.rpcUrls.default.http[0], {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params
          })
        });
        const data = await response.json();
        if (data.error) {
          throw data.error;
        }
        return data.result;
      } catch (err) {
        console.error(`GenLayer RPC error (${method}):`, err.message || err);
        throw err;
      }
    }
  };
};
var createClient = (config = { chain: _chunkNUO3HSVBcjs.localnet }) => {
  const chainConfig = config.chain || _chunkNUO3HSVBcjs.localnet;
  if (config.endpoint) {
    chainConfig.rpcUrls.default.http = [config.endpoint];
  }
  const customTransport = _viem.custom.call(void 0, getCustomTransportConfig(config, chainConfig), { retryCount: 0, retryDelay: 0 });
  const publicClient = createPublicClient(chainConfig, customTransport).extend(
    _viem.publicActions
  );
  const baseClient = _viem.createClient.call(void 0, {
    chain: chainConfig,
    transport: customTransport,
    ...config.account ? { account: config.account } : {}
  });
  const clientWithBasicActions = baseClient.extend(_viem.publicActions).extend(_viem.walletActions).extend((client) => accountActions(client, publicClient));
  const clientWithTransactionActions = {
    ...clientWithBasicActions,
    ...transactionActions(clientWithBasicActions, publicClient),
    ...chainActions(clientWithBasicActions),
    ...walletActions(clientWithBasicActions)
  };
  const clientWithAllActions = {
    ...clientWithTransactionActions,
    ...contractActions(clientWithTransactionActions, publicClient)
  };
  const clientWithReceiptActions = {
    ...clientWithAllActions,
    ...receiptActions(clientWithAllActions, publicClient)
  };
  const finalClient = {
    ...clientWithReceiptActions,
    ...stakingActions(clientWithReceiptActions, publicClient),
    ...vestingActions(clientWithReceiptActions, publicClient)
  };
  return finalClient;
};
var createPublicClient = (chainConfig, customTransport) => {
  return _viem.createPublicClient.call(void 0, { chain: chainConfig, transport: customTransport });
};

// src/accounts/account.ts

var generatePrivateKey = () => _accounts.generatePrivateKey.call(void 0, );
var createAccount = (accountPrivateKey) => {
  const privateKey = accountPrivateKey || generatePrivateKey();
  const account = _accounts.privateKeyToAccount.call(void 0, privateKey);
  return account;
};

// src/contracts/schema.ts
function buildGenVmPositionalArgs(options) {
  const { schema, functionName, valuesByParamName, strictTypes = true } = options;
  const method = schema.methods[functionName];
  if (!method) {
    throw new Error(`GenVM schema missing method: ${functionName}`);
  }
  return method.params.map(([name, type], index) => {
    if (!(name in valuesByParamName)) {
      throw new Error(
        `Missing argument "${name}" for ${functionName} (index ${index})`
      );
    }
    const value = valuesByParamName[name];
    if (strictTypes && !validateValueAgainstType(value, type)) {
      throw new Error(
        `Invalid argument "${name}" for ${functionName} (index ${index})`
      );
    }
    return value;
  });
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Map);
}
function validateValueAgainstType(value, type) {
  if (type === "any") return true;
  if (type === "null") return value === null;
  if (type === "bool") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (type === "bytes") {
    return typeof value === "string" || value instanceof Uint8Array;
  }
  if (type === "address") return typeof value === "string";
  if (type === "int") return typeof value === "number" || typeof value === "bigint";
  if (type === "array") return Array.isArray(value);
  if (type === "dict") return isPlainObject(value) || value instanceof Map;
  if (Array.isArray(type)) {
    if (!Array.isArray(value)) return false;
    if (type.length === 1 && typeof type[0] === "object" && type[0] !== null && "$rep" in type[0]) {
      const elementType = type[0].$rep;
      return value.every((v) => validateValueAgainstType(v, elementType));
    }
    return true;
  }
  if (isPlainObject(type)) {
    const orTypes = type.$or;
    if (Array.isArray(orTypes)) {
      return orTypes.some(
        (t) => validateValueAgainstType(value, t)
      );
    }
    if ("$dict" in type) {
      const dictType = type.$dict;
      if (value instanceof Map) {
        for (const v of value.values()) {
          if (!validateValueAgainstType(v, dictType)) return false;
        }
        return true;
      }
      if (!isPlainObject(value)) return false;
      return Object.values(value).every(
        (v) => validateValueAgainstType(v, dictType)
      );
    }
    if (isPlainObject(value)) {
      return Object.entries(type).every(([key, keyType]) => {
        if (!(key in value)) return true;
        return validateValueAgainstType(
          value[key],
          keyType
        );
      });
    }
  }
  return true;
}




































exports.CALL_KEY_DEPLOY = CALL_KEY_DEPLOY; exports.CALL_KEY_UNNAMED = CALL_KEY_UNNAMED; exports.CALL_KEY_WILDCARD = CALL_KEY_WILDCARD; exports.DEFAULT_FEES_DISTRIBUTION = DEFAULT_FEES_DISTRIBUTION; exports.DEPLOY_CALL_KEY = DEPLOY_CALL_KEY; exports.MESSAGE_ALLOCATION_ROOT_PARENT_INDEX = MESSAGE_ALLOCATION_ROOT_PARENT_INDEX; exports.MessageType = _chunkFKFYEOS7cjs.MessageType; exports.OPERATOR_REGISTRATION_DOMAIN = OPERATOR_REGISTRATION_DOMAIN; exports.abi = abi_exports; exports.buildGenVmPositionalArgs = buildGenVmPositionalArgs; exports.chains = _chunkNUO3HSVBcjs.chains_exports; exports.createAccount = createAccount; exports.createClient = createClient; exports.createFeesDistribution = createFeesDistribution; exports.createOperatorRegistration = createOperatorRegistration; exports.createTopUpFeesDistribution = createTopUpFeesDistribution; exports.decodeInputData = decodeInputData; exports.decodeLocalnetTransaction = decodeLocalnetTransaction; exports.decodeTransaction = decodeTransaction; exports.deployCallKey = deployCallKey; exports.deriveExternalMessageCallKey = deriveExternalMessageCallKey; exports.deriveInternalMessageCallKey = deriveInternalMessageCallKey; exports.encodeExternalMessageFeeParams = encodeExternalMessageFeeParams; exports.encodeInternalMessageFeeParams = encodeInternalMessageFeeParams; exports.formatStakingAmount = formatStakingAmount; exports.generatePrivateKey = generatePrivateKey; exports.isSuccessful = isSuccessful; exports.normalizeMessageFeeAllocations = normalizeMessageFeeAllocations; exports.normalizeTransactionFees = normalizeTransactionFees; exports.operatorAddressFromPublicKey = operatorAddressFromPublicKey; exports.operatorPossessionMessage = operatorPossessionMessage; exports.parseStakingAmount = parseStakingAmount; exports.simplifyTransactionReceipt = simplifyTransactionReceipt; exports.verifyOperatorRegistration = verifyOperatorRegistration; exports.vestingActions = vestingActions;
