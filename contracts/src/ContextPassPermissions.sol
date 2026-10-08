// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContextPass permissions
/// @notice The on-chain record of what an owner has allowed an AI app to access, and until when.
/// @dev Stores permission metadata only: who decided, which app, which scope, until when, and
///      whether it was revoked. The context itself never touches the chain — `app` and `scope`
///      are opaque identifiers (hashes) that ContextPass resolves off-chain.
contract ContextPassPermissions {
    /// Longest a single grant may last. Every permission must end on its own.
    uint64 public constant MAX_DURATION = 365 days;

    struct Permission {
        address owner; // the account that granted it — always msg.sender
        uint64 grantedAt;
        uint64 expiresAt;
        uint64 revokedAt; // 0 while not revoked
        uint64 grantedBlock; // lets clients fetch the grant transaction with a one-block log query
        uint64 revokedBlock;
        bytes32 app; // stable application identifier
        bytes32 scope; // identifier of the granted context scope set
    }

    mapping(bytes32 id => Permission) private _permissions;
    mapping(address owner => bytes32[] ids) private _owned;

    event PermissionGranted(
        bytes32 indexed id, address indexed owner, bytes32 indexed app, bytes32 scope, uint64 expiresAt
    );
    event PermissionRevoked(bytes32 indexed id, address indexed owner, bytes32 indexed app);

    error InvalidApp();
    error InvalidScope();
    error InvalidExpiry();
    error UnknownPermission();
    error NotOwner();
    error AlreadyRevoked();

    /// @notice Deterministic permission id: one per owner, app and scope set.
    function permissionId(address owner, bytes32 app, bytes32 scope) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, app, scope));
    }

    /// @notice Allow `app` to access `scope` until `expiresAt`. The caller is the owner.
    /// @dev Granting the same app and scope again renews it: new expiry, any revocation cleared.
    function grantPermission(bytes32 app, bytes32 scope, uint64 expiresAt) external returns (bytes32 id) {
        if (app == bytes32(0)) revert InvalidApp();
        if (scope == bytes32(0)) revert InvalidScope();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_DURATION) revert InvalidExpiry();

        id = permissionId(msg.sender, app, scope);
        Permission storage p = _permissions[id];
        if (p.owner == address(0)) _owned[msg.sender].push(id);

        p.owner = msg.sender;
        p.app = app;
        p.scope = scope;
        p.grantedAt = uint64(block.timestamp);
        p.expiresAt = expiresAt;
        p.revokedAt = 0;
        p.grantedBlock = uint64(block.number);
        p.revokedBlock = 0;

        emit PermissionGranted(id, msg.sender, app, scope, expiresAt);
    }

    /// @notice End a permission before it expires. Only its owner can.
    function revokePermission(bytes32 id) external {
        Permission storage p = _permissions[id];
        if (p.owner == address(0)) revert UnknownPermission();
        if (p.owner != msg.sender) revert NotOwner();
        if (p.revokedAt != 0) revert AlreadyRevoked();

        p.revokedAt = uint64(block.timestamp);
        p.revokedBlock = uint64(block.number);

        emit PermissionRevoked(id, msg.sender, p.app);
    }

    /// @notice True while granted, not revoked, and not yet expired.
    function isPermissionActive(bytes32 id) external view returns (bool) {
        Permission storage p = _permissions[id];
        return p.owner != address(0) && p.revokedAt == 0 && block.timestamp < p.expiresAt;
    }

    function getPermission(bytes32 id) external view returns (Permission memory) {
        return _permissions[id];
    }

    /// @notice Every permission an owner has ever granted, with its current record.
    function permissionsOf(address owner) external view returns (bytes32[] memory ids, Permission[] memory records) {
        ids = _owned[owner];
        records = new Permission[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            records[i] = _permissions[ids[i]];
        }
    }
}
