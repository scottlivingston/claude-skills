# Round 1 results

## Ship wave 1

Piece "Core VM skeleton" merged (a1b2c3d), scoped tests green, verification clean (no findings). Destination check, as far as the code reaches: `dm create demo && dm start demo && dm ssh demo -- cargo test` passes for Accretion's CPU tests; the GPU tests can't run yet (no GPU device).

## Spike: Does Venus GPU on libkrun work on macOS at all?

Answered: **yes, with patches.** Stock Homebrew virglrenderer crashes in its Venus code. virglrenderer built from main plus one 40-line patch to libkrun's virtio-gpu device runs Accretion's GPU tests at 94% of host frame time, and Raidboss's Playwright e2e passes. Prototype in `prototypes/venus/` (throwaway). The patched virglrenderer is MIT; the libkrun patch is ours.

## Follow-up questions the round's agents raised

1. What should happen when the guest reboots itself — does the VM come back up, and who restarts it?
2. We booted the stock Fedora kernel in the skeleton. Re-check the boot timings with our own product kernel before building further.
3. Benchmark the helper's in-process network stack; nobody has measured throughput yet.
4. Measure qcow2 overlay throughput against raw images for clones.
5. Measure build speed in the guest against a cold build on the host.
6. Should new VMs get the GPU by default, or only when asked?
7. Should v1 support devcontainer.json `FROM` lines?
8. The spike ran virglrenderer's render server inside the prototype's own unconfined process. D1 and the Design put it in the helper, under the helper's sandbox profile, and that profile grants no Metal or IOSurface access. Nobody has checked whether a sandboxed helper can open a Metal device at all; if it can't, the render server has to live outside the helper, which changes D1 and the Design's GPU path.
