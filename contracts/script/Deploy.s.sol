// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ContextPassPermissions} from "../src/ContextPassPermissions.sol";

/// Deploys ContextPassPermissions. The signing key is supplied on the command line
/// (--account or --private-key) and never stored in this repository.
contract Deploy is Script {
    function run() external returns (ContextPassPermissions deployed) {
        vm.startBroadcast();
        deployed = new ContextPassPermissions();
        vm.stopBroadcast();
        console.log("ContextPassPermissions deployed at", address(deployed));
    }
}
