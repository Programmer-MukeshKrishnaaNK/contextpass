// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ContextPassPermissions} from "../src/ContextPassPermissions.sol";

contract ContextPassPermissionsTest is Test {
    ContextPassPermissions internal permissions;

    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant APP = keccak256("contextpass.app:code-pilot");
    bytes32 internal constant SCOPE = keccak256("contextpass.scope:preferences.coding,projects.active");

    event PermissionGranted(
        bytes32 indexed id, address indexed owner, bytes32 indexed app, bytes32 scope, uint64 expiresAt
    );
    event PermissionRevoked(bytes32 indexed id, address indexed owner, bytes32 indexed app);

    function setUp() public {
        permissions = new ContextPassPermissions();
        vm.warp(1_800_000_000);
        vm.roll(100);
    }

    function _grant(uint64 duration) internal returns (bytes32 id) {
        vm.prank(owner);
        id = permissions.grantPermission(APP, SCOPE, uint64(block.timestamp) + duration);
    }

    /* ── Grant ─────────────────────────────────────────────── */

    function test_GrantRecordsOwnerAppScopeExpiry() public {
        uint64 expiresAt = uint64(block.timestamp) + 1 days;
        vm.prank(owner);
        bytes32 id = permissions.grantPermission(APP, SCOPE, expiresAt);

        ContextPassPermissions.Permission memory p = permissions.getPermission(id);
        assertEq(p.owner, owner);
        assertEq(p.app, APP);
        assertEq(p.scope, SCOPE);
        assertEq(p.expiresAt, expiresAt);
        assertEq(p.grantedAt, block.timestamp);
        assertEq(p.grantedBlock, block.number);
        assertEq(p.revokedAt, 0);
    }

    function test_GrantMakesPermissionActive() public {
        bytes32 id = _grant(1 hours);
        assertTrue(permissions.isPermissionActive(id));
    }

    function test_GrantIdIsDeterministic() public {
        bytes32 id = _grant(1 hours);
        assertEq(id, permissions.permissionId(owner, APP, SCOPE));
        assertEq(id, keccak256(abi.encode(owner, APP, SCOPE)));
    }

    function test_GrantEmitsEvent() public {
        uint64 expiresAt = uint64(block.timestamp) + 1 hours;
        bytes32 id = permissions.permissionId(owner, APP, SCOPE);
        vm.expectEmit(address(permissions));
        emit PermissionGranted(id, owner, APP, SCOPE, expiresAt);
        vm.prank(owner);
        permissions.grantPermission(APP, SCOPE, expiresAt);
    }

    function test_OwnerIsAlwaysTheSender() public {
        bytes32 ownersId = _grant(1 hours);
        vm.prank(stranger);
        bytes32 strangersId = permissions.grantPermission(APP, SCOPE, uint64(block.timestamp) + 1 hours);

        assertTrue(ownersId != strangersId, "a different sender gets a different permission");
        assertEq(permissions.getPermission(ownersId).owner, owner);
        assertEq(permissions.getPermission(strangersId).owner, stranger);
    }

    function test_RevertWhen_ExpiryIsNowOrPast() public {
        vm.startPrank(owner);
        vm.expectRevert(ContextPassPermissions.InvalidExpiry.selector);
        permissions.grantPermission(APP, SCOPE, uint64(block.timestamp));
        vm.expectRevert(ContextPassPermissions.InvalidExpiry.selector);
        permissions.grantPermission(APP, SCOPE, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_ExpiryBeyondMaxDuration() public {
        uint64 tooFar = uint64(block.timestamp) + permissions.MAX_DURATION() + 1;
        vm.prank(owner);
        vm.expectRevert(ContextPassPermissions.InvalidExpiry.selector);
        permissions.grantPermission(APP, SCOPE, tooFar);
    }

    function test_RevertWhen_AppOrScopeMissing() public {
        uint64 expiresAt = uint64(block.timestamp) + 1 hours;
        vm.startPrank(owner);
        vm.expectRevert(ContextPassPermissions.InvalidApp.selector);
        permissions.grantPermission(bytes32(0), SCOPE, expiresAt);
        vm.expectRevert(ContextPassPermissions.InvalidScope.selector);
        permissions.grantPermission(APP, bytes32(0), expiresAt);
        vm.stopPrank();
    }

    /* ── Revoke ────────────────────────────────────────────── */

    function test_OwnerCanRevoke() public {
        bytes32 id = _grant(1 days);
        vm.roll(block.number + 5);
        vm.warp(block.timestamp + 10 minutes);

        vm.expectEmit(address(permissions));
        emit PermissionRevoked(id, owner, APP);
        vm.prank(owner);
        permissions.revokePermission(id);

        ContextPassPermissions.Permission memory p = permissions.getPermission(id);
        assertFalse(permissions.isPermissionActive(id));
        assertEq(p.revokedAt, block.timestamp);
        assertEq(p.revokedBlock, block.number);
    }

    function test_RevertWhen_StrangerRevokes() public {
        bytes32 id = _grant(1 days);
        vm.prank(stranger);
        vm.expectRevert(ContextPassPermissions.NotOwner.selector);
        permissions.revokePermission(id);
        assertTrue(permissions.isPermissionActive(id), "still active after a failed revoke");
    }

    function test_RevertWhen_RevokingTwice() public {
        bytes32 id = _grant(1 days);
        vm.startPrank(owner);
        permissions.revokePermission(id);
        vm.expectRevert(ContextPassPermissions.AlreadyRevoked.selector);
        permissions.revokePermission(id);
        vm.stopPrank();
    }

    function test_RevertWhen_RevokingUnknown() public {
        vm.prank(owner);
        vm.expectRevert(ContextPassPermissions.UnknownPermission.selector);
        permissions.revokePermission(keccak256("nothing"));
    }

    /* ── Expiry ────────────────────────────────────────────── */

    function test_ExpiredPermissionIsInactive() public {
        bytes32 id = _grant(1 hours);
        vm.warp(block.timestamp + 1 hours - 1);
        assertTrue(permissions.isPermissionActive(id));
        vm.warp(block.timestamp + 1);
        assertFalse(permissions.isPermissionActive(id), "inactive at exactly expiresAt");
    }

    function test_UnknownPermissionIsInactive() public view {
        assertFalse(permissions.isPermissionActive(keccak256("nothing")));
    }

    /* ── Duplicates ────────────────────────────────────────── */

    function test_RegrantRenewsWithoutDuplicating() public {
        bytes32 id = _grant(1 hours);
        vm.prank(owner);
        permissions.revokePermission(id);

        vm.warp(block.timestamp + 1 minutes);
        bytes32 again = _grant(1 days);

        assertEq(again, id);
        assertTrue(permissions.isPermissionActive(id), "a renewed grant clears the revocation");
        assertEq(permissions.getPermission(id).revokedAt, 0);
        assertEq(permissions.getPermission(id).expiresAt, block.timestamp + 1 days);

        (bytes32[] memory ids,) = permissions.permissionsOf(owner);
        assertEq(ids.length, 1, "listed once");
    }

    function test_PermissionsOfListsEveryGrant() public {
        _grant(1 hours);
        bytes32 other = keccak256("contextpass.scope:memory.study,preferences.learning");
        vm.prank(owner);
        permissions.grantPermission(keccak256("contextpass.app:study-os"), other, uint64(block.timestamp) + 1 hours);

        (bytes32[] memory ids, ContextPassPermissions.Permission[] memory records) = permissions.permissionsOf(owner);
        assertEq(ids.length, 2);
        assertEq(records[1].scope, other);
        (bytes32[] memory none,) = permissions.permissionsOf(stranger);
        assertEq(none.length, 0);
    }
}
