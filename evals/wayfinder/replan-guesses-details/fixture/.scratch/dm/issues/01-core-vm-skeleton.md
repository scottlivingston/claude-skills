# Core VM skeleton: dm create / start / ssh / stop

Status: closed
Labels: impl

## What to build

`dm create <name>` clones the base image; `dm start` spawns the VM's helper, which boots the guest on libkrun and waits for the agent's `ready`; `dm ssh` runs a command in the guest over the guest channel; `dm stop` shuts it down. Builds on D1, D2.

## Acceptance criteria

- [x] `dm create demo && dm start demo && dm ssh demo -- uname -a` prints the guest kernel.
- [x] `dm stop demo` leaves no helper process running.

## Comments

Merged in ship wave 1 (a1b2c3d). Boot to ready 0.65 s; first `dm ssh` 0.8 s; stop 0.27 s.
