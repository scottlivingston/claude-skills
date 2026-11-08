# dm — devvm rewritten on libkrun

Status: open
Labels: spec, wayfinder:plan

## Destination

A Rust binary, `dm`, that makes, starts, connects to, and stops Project VMs on macOS through libkrun, with Venus GPU. The check: on this Mac, `dm create demo && dm start demo && dm ssh demo -- cargo test` passes inside the guest for Accretion, and Accretion's GPU tests pass in a GPU-on VM.

## Design

- **CLI** (`dm`): parses commands, owns config and state under `~/.local/share/dm`.
- **Helper**: one process per running VM, confined by a macOS sandbox profile that allows only the hypervisor, its VM's files, and its sockets; drives libkrun, serves the network stack and the mount table, and is the only thing that talks to the guest agent.
- **Guest agent**: in the guest image; answers exec, file, and readiness requests from the helper over vsock.
- **Images**: read-only base images built from Ubuntu's signed root tarball; each VM gets a copy-on-write clone.
- **GPU**: Venus over virtio-gpu, through virglrenderer and MoltenVK to Metal, off unless a VM asks for it.

## Where it stands

Nothing has been built yet.

## Problem Statement

devvm's Project VMs run on a hypervisor stack that can't give guests a GPU on macOS, so GPU-heavy projects can't test inside them.

## Solution

`dm` replaces devvm with the same workflow — create, start, ssh, stop — on libkrun, with an opt-in Venus GPU.

## User Stories

1. As a developer, I want `dm create` and `dm start` to give me a running VM for a project, so that I can build it in isolation.
2. As a developer, I want `dm ssh` into the VM, so that I can run my usual tools there.
3. As a developer, I want a GPU in the VM when I ask for one, so that GPU tests pass inside it.

## Decision Index

D1: Helper per VM — one helper process per running VM owns libkrun and the guest channel (setup)
D2: Guest channel — the helper and guest agent speak length-prefixed JSON over vsock port 1024 (setup)

## Testing Decisions

- **Seams under test**: the `dm` CLI's commands, observed from the host; the helper's guest-channel requests, observed at the agent.
- Tests exercise behaviour at those seams, never internals.

## Out of Scope

devcontainer.json support; Linux hosts (a later effort, run by the human on real Linux machines); importing devvm's VMs.

## Further Notes

**Principles (beyond PRINCIPLES.md):** own the code — patch upstream dependencies rather than wrap around them; boring defaults over options; a feature devvm has that nobody uses is cut.

**Merge authorization:** no — offer the PR.

**Machines and services:** this Mac only. Anything on Linux is a human task.

## Decisions

### D1: Helper per VM

- **Decided:** each running VM has one helper process that owns its libkrun context and its guest channel; the CLI talks only to helpers.
- **Because:** Design names the helper as the only thing that talks to the guest.
- **Rejected:** one daemon for all VMs — a crash takes every VM down.
- **Origin:** setup.

### D2: Guest channel

- **Decided:** length-prefixed JSON messages over vsock port 1024; request kinds `exec`, `file`, `ready`.
- **Because:** smallest thing that serves the Design's three request kinds.
- **Rejected:** gRPC — a code generator for three messages.
- **Origin:** setup.
